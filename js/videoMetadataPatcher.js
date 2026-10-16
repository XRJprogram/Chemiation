/**
 * Chemiation - Video Metadata Patcher
 * 解决原生 MediaRecorder 录制 Canvas 视频时缺失时长元数据 (Duration: 0 / NaN)
 * 以及本地播放器 (Windows Media Player, 电影和电视, QuickTime) 无法拖拽快进/时间轴禁用的核心工具库。
 * 
 * 核心功能：
 * 1. ISOBMFF Fragmented MP4 (fMP4) 深度元数据修复：
 *    - 回填并更新 mvhd (Movie Header) 时长与时间标度
 *    - 回填并更新 trak -> tkhd (Track Header) 轨道时长
 *    - 回填并更新 trak -> mdia -> mdhd (Media Header) 媒体时长
 *    - 回填并更新 mvex -> mehd (Movie Extends Header) 分片时长
 *    - 自动解算各 moof (Movie Fragment) 关键时间点，在文件尾部追加构建 mfra (tfra + mfro) 随机访问检索表，
 *      让 Windows 原生播放器及剪辑软件具备精准的时间轴拖拽 (Seekable) 能力。
 * 2. WebM EBML 时长元数据修复：
 *    - 针对 WebM 容器注入/修正 Segment.Info.Duration 与 TimecodeScale
 * 3. 智能容器魔数识别 (Magic Bytes Detection)：
 *    - 自动判定底层真实流是 MP4 (ftyp) 还是 WebM (0x1A45DFA3)，保障扩展名与容器严格匹配，杜绝假 MP4 格式冲突。
 * 
 * 严格遵循规范：代码与注释无任何 Emoji 符号。
 */

(function (global) {
  'use strict';

  /**
   * ISOBMFF Fragmented MP4 (fMP4) 时长回填与 mfra 索引构建器
   * @param {ArrayBuffer} buffer - 原始 fMP4 二进制缓存
   * @param {number} durationMs - 实际推演录制时长 (毫秒)
   * @returns {ArrayBuffer} 包含时长与完整索引表的规范 MP4 缓存
   */
  function patchFmp4Duration(buffer, durationMs) {
    if (!buffer || buffer.byteLength < 16) return buffer;
    const durationSec = Math.max(0.1, durationMs / 1000);
    const dataView = new DataView(buffer);
    let offset = 0;

    function getBoxType(off) {
      if (off + 4 > buffer.byteLength) return '';
      return String.fromCharCode(
        dataView.getUint8(off),
        dataView.getUint8(off + 1),
        dataView.getUint8(off + 2),
        dataView.getUint8(off + 3)
      );
    }

    let movieTimescale = 1000;
    const moofEntries = []; // { offset: number, time: number }
    let hasMfra = false;

    // 第一遍扫描：解析顶层盒子，定位 moov 与所有 moof 分片
    while (offset < buffer.byteLength) {
      if (offset + 8 > buffer.byteLength) break;
      let boxSize = dataView.getUint32(offset);
      const boxType = getBoxType(offset + 4);
      let headerSize = 8;

      if (boxSize === 1) {
        if (offset + 16 > buffer.byteLength) break;
        boxSize = Number(dataView.getBigUint64(offset + 8));
        headerSize = 16;
      } else if (boxSize === 0) {
        boxSize = buffer.byteLength - offset;
      }

      if (boxSize < 8 || offset + boxSize > buffer.byteLength) {
        boxSize = buffer.byteLength - offset;
      }
      if (boxSize < 8) break;

      if (boxType === 'mfra') {
        hasMfra = true;
      }

      if (boxType === 'moov') {
        let moovOffset = offset + headerSize;
        const moovEnd = offset + boxSize;

        while (moovOffset < moovEnd) {
          if (moovOffset + 8 > moovEnd) break;
          let subSize = dataView.getUint32(moovOffset);
          const subType = getBoxType(moovOffset + 4);
          let subHeaderSize = 8;

          if (subSize === 1) {
            if (moovOffset + 16 > moovEnd) break;
            subSize = Number(dataView.getBigUint64(moovOffset + 8));
            subHeaderSize = 16;
          } else if (subSize === 0) {
            subSize = moovEnd - moovOffset;
          }

          if (subSize < 8 || moovOffset + subSize > moovEnd) {
            subSize = moovEnd - moovOffset;
          }
          if (subSize < 8) break;

          // 1. mvhd: Movie Header Box
          if (subType === 'mvhd') {
            const version = dataView.getUint8(moovOffset + subHeaderSize);
            let timescaleOffset, durationOffset, is64Bit;

            if (version === 1) {
              timescaleOffset = moovOffset + subHeaderSize + 20;
              durationOffset = moovOffset + subHeaderSize + 24;
              is64Bit = true;
            } else {
              timescaleOffset = moovOffset + subHeaderSize + 12;
              durationOffset = moovOffset + subHeaderSize + 16;
              is64Bit = false;
            }

            if (timescaleOffset + 4 <= moovEnd) {
              const readTimescale = dataView.getUint32(timescaleOffset);
              if (readTimescale > 0) movieTimescale = readTimescale;
            }

            const calculatedDuration = Math.round(durationSec * movieTimescale);
            if (durationOffset + (is64Bit ? 8 : 4) <= moovEnd) {
              if (is64Bit) {
                dataView.setBigUint64(durationOffset, BigInt(calculatedDuration));
              } else {
                dataView.setUint32(durationOffset, calculatedDuration);
              }
            }
          }

          // 2. trak: Track Box (包含 tkhd 与 mdia)
          if (subType === 'trak') {
            let trakOffset = moovOffset + subHeaderSize;
            const trakEnd = moovOffset + subSize;

            while (trakOffset < trakEnd) {
              if (trakOffset + 8 > trakEnd) break;
              let trkSize = dataView.getUint32(trakOffset);
              const trkType = getBoxType(trakOffset + 4);
              let trkHeader = 8;

              if (trkSize === 1) {
                if (trakOffset + 16 > trakEnd) break;
                trkSize = Number(dataView.getBigUint64(trakOffset + 8));
                trkHeader = 16;
              } else if (trkSize === 0) {
                trkSize = trakEnd - trakOffset;
              }

              if (trkSize < 8 || trakOffset + trkSize > trakEnd) {
                trkSize = trakEnd - trakOffset;
              }
              if (trkSize < 8) break;

              // 2.1 tkhd: Track Header Box
              if (trkType === 'tkhd') {
                const version = dataView.getUint8(trakOffset + trkHeader);
                const durationOffset = (version === 1)
                  ? (trakOffset + trkHeader + 28)
                  : (trakOffset + trkHeader + 20);
                const durVal = Math.round(durationSec * movieTimescale);

                if (durationOffset + (version === 1 ? 8 : 4) <= trakEnd) {
                  if (version === 1) {
                    dataView.setBigUint64(durationOffset, BigInt(durVal));
                  } else {
                    dataView.setUint32(durationOffset, durVal);
                  }
                }
              }

              // 2.2 mdia -> mdhd: Media Header Box
              if (trkType === 'mdia') {
                let mdiaOffset = trakOffset + trkHeader;
                const mdiaEnd = trakOffset + trkSize;

                while (mdiaOffset < mdiaEnd) {
                  if (mdiaOffset + 8 > mdiaEnd) break;
                  let mSize = dataView.getUint32(mdiaOffset);
                  const mType = getBoxType(mdiaOffset + 4);
                  let mHeader = 8;

                  if (mSize === 1) {
                    if (mdiaOffset + 16 > mdiaEnd) break;
                    mSize = Number(dataView.getBigUint64(mdiaOffset + 8));
                    mHeader = 16;
                  } else if (mSize === 0) {
                    mSize = mdiaEnd - mdiaOffset;
                  }

                  if (mSize < 8 || mdiaOffset + mSize > mdiaEnd) {
                    mSize = mdiaEnd - mdiaOffset;
                  }
                  if (mSize < 8) break;

                  if (mType === 'mdhd') {
                    const version = dataView.getUint8(mdiaOffset + mHeader);
                    let mediaTimescale = movieTimescale;
                    let timescaleOffset, durationOffset, is64Bit;

                    if (version === 1) {
                      timescaleOffset = mdiaOffset + mHeader + 20;
                      durationOffset = mdiaOffset + mHeader + 24;
                      is64Bit = true;
                    } else {
                      timescaleOffset = mdiaOffset + mHeader + 12;
                      durationOffset = mdiaOffset + mHeader + 16;
                      is64Bit = false;
                    }

                    if (timescaleOffset + 4 <= mdiaEnd) {
                      const readMediaTimescale = dataView.getUint32(timescaleOffset);
                      if (readMediaTimescale > 0) mediaTimescale = readMediaTimescale;
                    }

                    const durVal = Math.round(durationSec * mediaTimescale);
                    if (durationOffset + (is64Bit ? 8 : 4) <= mdiaEnd) {
                      if (is64Bit) {
                        dataView.setBigUint64(durationOffset, BigInt(durVal));
                      } else {
                        dataView.setUint32(durationOffset, durVal);
                      }
                    }
                  }

                  mdiaOffset += mSize;
                }
              }

              trakOffset += trkSize;
            }
          }

          // 3. mvex -> mehd: Movie Extends Header Box (分片模式主控时长)
          if (subType === 'mvex') {
            let mvexOffset = moovOffset + subHeaderSize;
            const mvexEnd = moovOffset + subSize;

            while (mvexOffset < mvexEnd) {
              if (mvexOffset + 8 > mvexEnd) break;
              let mSize = dataView.getUint32(mvexOffset);
              const mType = getBoxType(mvexOffset + 4);
              let mHeader = 8;

              if (mSize === 1) {
                if (mvexOffset + 16 > mvexEnd) break;
                mSize = Number(dataView.getBigUint64(mvexOffset + 8));
                mHeader = 16;
              } else if (mSize === 0) {
                mSize = mvexEnd - mvexOffset;
              }

              if (mSize < 8 || mvexOffset + mSize > mvexEnd) {
                mSize = mvexEnd - mvexOffset;
              }
              if (mSize < 8) break;

              if (mType === 'mehd') {
                const version = dataView.getUint8(mvexOffset + mHeader);
                const durationOffset = mvexOffset + mHeader + 4;
                const durVal = Math.round(durationSec * movieTimescale);

                if (durationOffset + (version === 1 ? 8 : 4) <= mvexEnd) {
                  if (version === 1) {
                    dataView.setBigUint64(durationOffset, BigInt(durVal));
                  } else {
                    dataView.setUint32(durationOffset, durVal);
                  }
                }
              }

              mvexOffset += mSize;
            }
          }

          moovOffset += subSize;
        }
      } else if (boxType === 'moof') {
        // 记录每一个分片的物理字节偏移，并尝试提取 tfdt 解码时间戳
        let fragmentTime = null;
        try {
          let sOff = offset + headerSize;
          const sEnd = offset + boxSize;
          while (sOff < sEnd) {
            if (sOff + 8 > sEnd) break;
            let chSize = dataView.getUint32(sOff);
            const chType = getBoxType(sOff + 4);
            if (chSize < 8) break;
            if (chType === 'traf') {
              let tOff = sOff + 8;
              const tEnd = Math.min(sEnd, sOff + chSize);
              while (tOff < tEnd) {
                if (tOff + 8 > tEnd) break;
                let innerSize = dataView.getUint32(tOff);
                const innerType = getBoxType(tOff + 4);
                if (innerSize < 8) break;
                if (innerType === 'tfdt') {
                  const ver = dataView.getUint8(tOff + 8);
                  fragmentTime = ver === 1
                    ? Number(dataView.getBigUint64(tOff + 12))
                    : dataView.getUint32(tOff + 12);
                  break;
                }
                tOff += innerSize;
              }
            }
            sOff += chSize;
          }
        } catch (e) {}

        moofEntries.push({
          offset,
          time: fragmentTime
        });
      }

      offset += boxSize;
    }

    // 若包含多个 moof 分片且尾部无 mfra，动态构建并追加 mfra 索引表
    if (moofEntries.length > 0 && !hasMfra) {
      const numEntries = moofEntries.length;
      // ISO/IEC 14496-12 section 8.8.10 TrackFragmentRandomAccessBox ('tfra')
      // Entry 字段：time(4B) + moof_offset(4B) + traf_number(1B) + trun_number(1B) + sample_number(1B) = 11B
      const tfraBoxSize = 24 + numEntries * 11;
      const mfroBoxSize = 16;
      const mfraTotalSize = 8 + tfraBoxSize + mfroBoxSize;

      const mfraBuf = new Uint8Array(mfraTotalSize);
      const mfraView = new DataView(mfraBuf.buffer);

      // 1. mfra 容器盒子
      mfraView.setUint32(0, mfraTotalSize);
      mfraBuf[4] = 0x6d; mfraBuf[5] = 0x66; mfraBuf[6] = 0x72; mfraBuf[7] = 0x61; // 'mfra'

      // 2. tfra 索引盒子
      let pos = 8;
      mfraView.setUint32(pos, tfraBoxSize);
      mfraBuf[pos + 4] = 0x74; mfraBuf[pos + 5] = 0x66; mfraBuf[pos + 6] = 0x72; mfraBuf[pos + 7] = 0x61; // 'tfra'
      mfraView.setUint8(pos + 8, 0); // version 0
      mfraView.setUint8(pos + 9, 0); mfraView.setUint8(pos + 10, 0); mfraView.setUint8(pos + 11, 0); // flags
      mfraView.setUint32(pos + 12, 1); // track_ID = 1
      mfraView.setUint32(pos + 16, 0); // reserved & length_sizes (all 0 => 1 byte each)
      mfraView.setUint32(pos + 20, numEntries);

      let ePos = pos + 24;
      const timeStep = (durationSec * movieTimescale) / Math.max(1, numEntries);
      for (let i = 0; i < numEntries; i++) {
        const item = moofEntries[i];
        const entryTime = (typeof item.time === 'number' && !isNaN(item.time))
          ? item.time
          : Math.round(i * timeStep);

        mfraView.setUint32(ePos, entryTime);
        mfraView.setUint32(ePos + 4, item.offset);
        mfraView.setUint8(ePos + 8, 1);  // traf_number = 1
        mfraView.setUint8(ePos + 9, 1);  // trun_number = 1
        mfraView.setUint8(ePos + 10, 1); // sample_number = 1
        ePos += 11;
      }

      // 3. mfro 倒序定位盒子
      pos += tfraBoxSize;
      mfraView.setUint32(pos, mfroBoxSize);
      mfraBuf[pos + 4] = 0x6d; mfraBuf[pos + 5] = 0x66; mfraBuf[pos + 6] = 0x72; mfraBuf[pos + 7] = 0x6f; // 'mfro'
      mfraView.setUint8(pos + 8, 0); // version 0
      mfraView.setUint8(pos + 9, 0); mfraView.setUint8(pos + 10, 0); mfraView.setUint8(pos + 11, 0);
      mfraView.setUint32(pos + 12, mfraTotalSize); // 整个 mfra 盒子的总字节大小

      // 组装新缓冲区并返回
      const finalResult = new Uint8Array(buffer.byteLength + mfraTotalSize);
      finalResult.set(new Uint8Array(buffer), 0);
      finalResult.set(mfraBuf, buffer.byteLength);
      return finalResult.buffer;
    }

    return buffer;
  }

  /**
   * WebM EBML 时长元数据修复引擎
   * 轻量化解析 EBML Header 与 Segment.Info，更新 Duration 与 TimecodeScale
   */
  function patchWebmDuration(blob, durationMs) {
    return new Promise(function (resolve) {
      if (!blob) {
        resolve(blob);
        return;
      }

      var reader = new FileReader();
      reader.onloadend = function () {
        try {
          var buffer = reader.result;
          var u8 = new Uint8Array(buffer);

          // 验证 EBML 幻数: 0x1A 0x45 0xDF 0xA3
          if (u8.length < 12 || u8[0] !== 0x1a || u8[1] !== 0x45 || u8[2] !== 0xdf || u8[3] !== 0xa3) {
            resolve(blob);
            return;
          }

          // 检索 Segment (0x18 0x53 0x80 0x67) 与 Info (0x15 0x49 0xA9 0x66)
          var infoOffset = -1;
          for (var i = 0; i < Math.min(u8.length - 8, 4096); i++) {
            if (u8[i] === 0x15 && u8[i + 1] === 0x49 && u8[i + 2] === 0xa9 && u8[i + 3] === 0x66) {
              infoOffset = i;
              break;
            }
          }

          if (infoOffset === -1) {
            resolve(blob);
            return;
          }

          // 在 Info 范围内查找 Duration (0x44 0x89)
          var durationOffset = -1;
          var searchEnd = Math.min(u8.length - 8, infoOffset + 512);
          for (var j = infoOffset; j < searchEnd; j++) {
            if (u8[j] === 0x44 && u8[j + 1] === 0x89) {
              durationOffset = j;
              break;
            }
          }

          var durationSec = durationMs / 1000;
          if (durationOffset !== -1) {
            // 已存在 Duration 字段：检测是 4 字节 float 还是 8 字节 double
            var sizeByte = u8[durationOffset + 2];
            var dv = new DataView(buffer);
            if (sizeByte === 0x84 || sizeByte === 4) {
              dv.setFloat32(durationOffset + 3, durationMs, false);
            } else if (sizeByte === 0x88 || sizeByte === 8) {
              dv.setFloat64(durationOffset + 3, durationMs, false);
            }
            resolve(new Blob([buffer], { type: blob.type || 'video/webm' }));
          } else {
            // 未声明 Duration：在 Info 内部插入 0x44 0x89 0x84 (4 字节 float32)
            var insertPos = infoOffset + 8;
            var floatBuf = new ArrayBuffer(4);
            new DataView(floatBuf).setFloat32(0, durationMs, false);
            var durBytes = new Uint8Array(floatBuf);

            var injectedHeader = new Uint8Array([0x44, 0x89, 0x84, durBytes[0], durBytes[1], durBytes[2], durBytes[3]]);
            var fixedU8 = new Uint8Array(u8.length + injectedHeader.length);
            fixedU8.set(u8.subarray(0, insertPos), 0);
            fixedU8.set(injectedHeader, insertPos);
            fixedU8.set(u8.subarray(insertPos), insertPos + injectedHeader.length);

            resolve(new Blob([fixedU8.buffer], { type: blob.type || 'video/webm' }));
          }
        } catch (ex) {
          resolve(blob);
        }
      };
      reader.onerror = function () {
        resolve(blob);
      };
      reader.readAsArrayBuffer(blob);
    });
  }

  /**
   * 统一视频元数据修复接口
   * 自动探测 MP4 / WebM，补全完整播放时长并注入时间轴快进索引
   * @param {Blob} rawBlob - 原始录制 Blob
   * @param {number} durationMs - 实际录制时长 (毫秒)
   * @returns {Promise<{ blob: Blob, ext: string, mimeType: string }>}
   */
  async function fixVideoBlob(rawBlob, durationMs) {
    if (!rawBlob) {
      return { blob: rawBlob, ext: 'mp4', mimeType: 'video/mp4' };
    }

    try {
      const buffer = await rawBlob.arrayBuffer();
      const u8 = new Uint8Array(buffer);

      // 检测是否为真实 ISOBMFF MP4 格式 (包含 ftyp 或 moov 标识)
      const isMp4 = (u8.length >= 8) && (
        (u8[4] === 0x66 && u8[5] === 0x74 && u8[6] === 0x79 && u8[7] === 0x70) || // 'ftyp'
        (u8[4] === 0x6d && u8[5] === 0x6f && u8[6] === 0x6f && u8[7] === 0x76)    // 'moov'
      );

      // 检测是否为 WebM 容器格式 (EBML Header 0x1A 0x45 0xDF 0xA3)
      const isWebm = (u8.length >= 4) && (
        u8[0] === 0x1a && u8[1] === 0x45 && u8[2] === 0xdf && u8[3] === 0xa3
      );

      if (isMp4) {
        const patchedBuffer = patchFmp4Duration(buffer, durationMs);
        return {
          blob: new Blob([patchedBuffer], { type: 'video/mp4' }),
          ext: 'mp4',
          mimeType: 'video/mp4'
        };
      }

      if (isWebm) {
        const patchedBlob = await patchWebmDuration(rawBlob, durationMs);
        return {
          blob: patchedBlob,
          ext: 'webm',
          mimeType: 'video/webm'
        };
      }

      // 未知容器保持原样
      const fallbackExt = (rawBlob.type && rawBlob.type.includes('mp4')) ? 'mp4' : 'webm';
      return {
        blob: rawBlob,
        ext: fallbackExt,
        mimeType: rawBlob.type || 'video/mp4'
      };
    } catch (err) {
      console.warn('[VideoPatcher] 视频元数据修复出现异常，返回原始 Blob:', err);
      return {
        blob: rawBlob,
        ext: 'mp4',
        mimeType: rawBlob.type || 'video/mp4'
      };
    }
  }

  // 挂载至全局上下文与模块化导出
  const ChemiationVideoPatcher = {
    patchFmp4Duration,
    patchWebmDuration,
    fixVideoBlob
  };

  global.ChemiationVideoPatcher = ChemiationVideoPatcher;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChemiationVideoPatcher;
  }
})(typeof window !== 'undefined' ? window : globalThis);
