/**
 * Playwright 反指纹插件 - 跨标签页会话一致性版本
 *
 * 功能特性：
 * 1. 每次浏览器会话生成唯一指纹
 * 2. 同一会话内所有页面共享相同指纹
 * 3. 支持自定义设备配置文件
 * 4. 完整的指纹保护（Canvas、WebGL、Audio、字体等）
 * 5. 反自动化检测（隐藏 Playwright/Puppeteer 特征）
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_DEVICE_PROFILES } from './device-profiles.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Playwright 反指纹插件类
 */
export class PlaywrightAntiFingerprintPlugin {
	constructor(options = {}) {
		// 配置选项
		this.options = {
			// 是否启用调试日志
			debug: false,
			// 是否启用跨标签页一致性
			crossTabConsistency: true,
			// 自定义设备配置文件
			deviceProfiles: DEFAULT_DEVICE_PROFILES,
			// 会话种子（不设置则自动生成）
			sessionSeed: null,
			// 心跳间隔（毫秒）
			heartbeatInterval: 2000,
			// 会话超时（毫秒）
			sessionTimeout: 5000,
			...options,
		};

		// 生成或使用提供的会话种子
		this.sessionSeed = this.options.sessionSeed || Math.random();

		// 选择设备配置文件
		this.selectedProfile = this._selectProfile();
	}

	/**
	 * 选择设备配置文件
	 */
	_selectProfile() {
		const profiles = this.options.deviceProfiles;
		const index = Math.floor(this.sessionSeed * profiles.length);
		return profiles[index % profiles.length];
	}

	/**
	 * 生成注入脚本
	 */
	injectionScript(context) {
		// 准备配置数据
		const configData = {
			sessionSeed: this.sessionSeed,
			selectedProfile: this.selectedProfile,
			crossTabConsistency: this.options.crossTabConsistency,
			heartbeatInterval: this.options.heartbeatInterval,
			sessionTimeout: this.options.sessionTimeout,
			debug: this.options.debug,
		};

		return context.addInitScript((injectedConfig) => {
			const CONFIG = injectedConfig;

			// ==================== 跨标签页会话种子管理 ====================
			const getSessionSeed = () => {
				if (!CONFIG.crossTabConsistency) {
					return CONFIG.sessionSeed;
				}

				const SEED_KEY = '__fp_cross_tab_seed';
				const HEARTBEAT_KEY = '__fp_heartbeat';
				const HEARTBEAT_INTERVAL = CONFIG.heartbeatInterval;
				const SESSION_TIMEOUT = CONFIG.sessionTimeout;

				// 检查是否有活跃的会话
				const checkActiveSession = () => {
					const lastHeartbeat = localStorage.getItem(HEARTBEAT_KEY);
					if (!lastHeartbeat) return false;
					const elapsed = Date.now() - parseInt(lastHeartbeat);
					return elapsed < SESSION_TIMEOUT;
				};

				// 更新心跳
				const updateHeartbeat = () => {
					localStorage.setItem(HEARTBEAT_KEY, Date.now().toString());
				};

				// 获取或创建种子
				let seed = localStorage.getItem(SEED_KEY);

				if (!seed || !checkActiveSession()) {
					seed = CONFIG.sessionSeed.toString();
					localStorage.setItem(SEED_KEY, seed);
					updateHeartbeat();
					if (CONFIG.debug) {
						console.log('%c🔑 生成新的跨标签页会话指纹种子', 'color: #10b981; font-weight: bold;');
					}
				} else {
					if (CONFIG.debug) {
						console.log('%c🔄 使用现有跨标签页会话指纹种子', 'color: #3b82f6; font-weight: bold;');
					}
				}

				// 设置定期心跳
				setInterval(updateHeartbeat, HEARTBEAT_INTERVAL);

				// 监听页面关闭事件
				window.addEventListener('beforeunload', () => {
					const channel = new BroadcastChannel('fingerprint_session');
					let hasOtherTabs = false;

					channel.postMessage({ type: 'ping' });

					setTimeout(() => {
						if (!hasOtherTabs) {
							localStorage.removeItem(SEED_KEY);
							localStorage.removeItem(HEARTBEAT_KEY);
						}
						channel.close();
					}, 100);

					channel.onmessage = (e) => {
						if (e.data.type === 'pong') {
							hasOtherTabs = true;
						}
					};
				});

				// 响应其他标签页的ping
				const channel = new BroadcastChannel('fingerprint_session');
				channel.onmessage = (e) => {
					if (e.data.type === 'ping') {
						channel.postMessage({ type: 'pong' });
					}
				};

				return parseFloat(seed) || Math.random();
			};

			const sessionSeed = getSessionSeed();
			const selectedProfile = CONFIG.selectedProfile;

			// ==================== 伪随机数生成器 ====================
			class SeededRandom {
				constructor(seed) {
					this.seed = seed;
					this.counter = 0;
				}

				next() {
					this.counter++;
					const x = Math.sin(this.seed * this.counter + this.counter) * 10000;
					return x - Math.floor(x);
				}

				float(min, max) {
					return this.next() * (max - min) + min;
				}

				int(min, max) {
					return Math.floor(this.float(min, max + 1));
				}

				choice(array) {
					return array[this.int(0, array.length - 1)];
				}
			}

			const random = new SeededRandom(sessionSeed);

			// ==================== 反自动化检测 ====================
			// 1. 覆盖 navigator.webdriver - 最关键的反自动化检测
			Object.defineProperty(navigator, 'webdriver', {
				get: () => false,
				configurable: true,
			});

			// 2. 添加 window.chrome 对象 - 模拟真实 Chrome 浏览器
			if (!window.chrome) {
				window.chrome = {
					runtime: {},
					loadTimes: function () {},
					csi: function () {},
					app: {},
				};
			}

			// 3. 覆盖 permissions.query - 处理通知权限查询
			if (navigator.permissions && navigator.permissions.query) {
				const originalQuery = navigator.permissions.query;
				navigator.permissions.query = (parameters) =>
					parameters.name === 'notifications'
						? Promise.resolve({ state: Notification.permission })
						: originalQuery(parameters);
			}

			// ==================== Canvas 指纹保护 ====================
			const protectCanvas = (() => {
				const canvasRandom = new SeededRandom(sessionSeed * 2);

				const originalMethods = {
					toDataURL: HTMLCanvasElement.prototype.toDataURL,
					toBlob: HTMLCanvasElement.prototype.toBlob,
					getImageData: CanvasRenderingContext2D.prototype.getImageData,
					putImageData: CanvasRenderingContext2D.prototype.putImageData,
					fillText: CanvasRenderingContext2D.prototype.fillText,
					strokeText: CanvasRenderingContext2D.prototype.strokeText,
					measureText: CanvasRenderingContext2D.prototype.measureText,
				};

				const injectNoise = (imageData) => {
					const data = imageData.data;
					const length = data.length;

					for (let i = 0; i < length; i += 4) {
						if (data[i + 3] > 0) {
							const noise = canvasRandom.float(-0.5, 0.5);
							data[i] = Math.min(255, Math.max(0, data[i] + noise));
							data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
							data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
						}
					}

					return imageData;
				};

				HTMLCanvasElement.prototype.toDataURL = function (...args) {
					const context = this.getContext('2d');
					if (context) {
						const imageData = originalMethods.getImageData.call(
							context,
							0,
							0,
							this.width,
							this.height
						);
						const noisyData = injectNoise(imageData);
						originalMethods.putImageData.call(context, noisyData, 0, 0);
					}
					return originalMethods.toDataURL.apply(this, args);
				};

				HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
					const context = this.getContext('2d');
					if (context) {
						const imageData = originalMethods.getImageData.call(
							context,
							0,
							0,
							this.width,
							this.height
						);
						const noisyData = injectNoise(imageData);
						originalMethods.putImageData.call(context, noisyData, 0, 0);
					}
					return originalMethods.toBlob.call(this, callback, ...args);
				};

				CanvasRenderingContext2D.prototype.getImageData = function (...args) {
					const imageData = originalMethods.getImageData.apply(this, args);
					return injectNoise(imageData);
				};

				CanvasRenderingContext2D.prototype.fillText = function (text, x, y, ...args) {
					const offsetX = canvasRandom.float(-0.1, 0.1);
					const offsetY = canvasRandom.float(-0.1, 0.1);
					return originalMethods.fillText.call(this, text, x + offsetX, y + offsetY, ...args);
				};

				CanvasRenderingContext2D.prototype.strokeText = function (text, x, y, ...args) {
					const offsetX = canvasRandom.float(-0.1, 0.1);
					const offsetY = canvasRandom.float(-0.1, 0.1);
					return originalMethods.strokeText.call(this, text, x + offsetX, y + offsetY, ...args);
				};

				CanvasRenderingContext2D.prototype.measureText = function (text) {
					const metrics = originalMethods.measureText.call(this, text);
					const factor = 1 + canvasRandom.float(-0.003, 0.003);

					return new Proxy(metrics, {
						get(target, prop) {
							if (typeof target[prop] === 'number') {
								return target[prop] * factor;
							}
							return target[prop];
						},
					});
				};
			})();

			// ==================== WebGL 指纹保护 ====================
			const protectWebGL = (() => {
				const webglRandom = new SeededRandom(sessionSeed * 3);

				const gpuInfo = {
					vendor: selectedProfile.gpu.vendor,
					renderer: 'ANGLE (' + selectedProfile.gpu.renderer + ' Direct3D11 vs_5_0 ps_5_0)',
				};

				const standardParams = {
					2849: 1,
					2884: 1,
					2885: 2305,
					2886: 1,
					2928: [0, 1],
					2929: 1,
					2930: 1,
					2931: 2929,
					2932: 513,
					2960: 0,
					2961: new Int32Array([0, 0, 300, 300]),
					2962: 1,
					2963: 519,
					2964: 7680,
					2965: 7680,
					2966: 7680,
					2967: 0,
					2968: 1,
					3024: 1,
					3042: 0,
					3088: [0, 0, 300, 300],
					3106: new Float32Array([1, 1, 1, 1]),
					3107: [true, true, true, true],
					7936: 'WebKit',
					7937: 'WebKit WebGL',
					7938: 'WebGL 1.0 (OpenGL ES 2.0 Chromium)',
					32773: 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)',
					32777: 32883,
					33170: 4352,
					33901: [1, 1],
					33902: [1, 255],
					34016: 32 + webglRandom.int(-2, 2),
					34024: 16384 + webglRandom.int(-512, 512),
					34076: 16384 + webglRandom.int(-512, 512),
					34467: 16,
					34816: 16,
					34817: 16,
					34818: 32,
					34819: 4096,
					34877: 4096,
					34921: 16,
					34930: 16384,
					35660: 16,
					35661: 32768,
					35724: 'WebGL 1.0',
					35738: 'WebKit',
					35739: 'WebKit WebGL',
					36347: 4096,
					36348: 4096,
					36349: new Float32Array([16384, 16384]),
					37440: 16,
					37441: 16,
					37443: 2,
				};

				if (window.WebGLRenderingContext) {
					const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
					const originalGetShaderPrecisionFormat =
						WebGLRenderingContext.prototype.getShaderPrecisionFormat;
					const originalGetSupportedExtensions =
						WebGLRenderingContext.prototype.getSupportedExtensions;

					WebGLRenderingContext.prototype.getParameter = function (parameter) {
						if (parameter === 37445 || parameter === 37446) {
							const debugInfo = this.getExtension('WEBGL_debug_renderer_info');
							if (debugInfo) {
								if (parameter === debugInfo.UNMASKED_VENDOR_WEBGL) {
									return gpuInfo.vendor;
								}
								if (parameter === debugInfo.UNMASKED_RENDERER_WEBGL) {
									return gpuInfo.renderer;
								}
							}
						}

						if (standardParams.hasOwnProperty(parameter)) {
							return standardParams[parameter];
						}

						return originalGetParameter.call(this, parameter);
					};

					WebGLRenderingContext.prototype.getShaderPrecisionFormat = function (
						shaderType,
						precisionType
					) {
						return {
							rangeMin: 127,
							rangeMax: 127,
							precision: 23 + webglRandom.int(0, 1),
						};
					};

					WebGLRenderingContext.prototype.getSupportedExtensions = function () {
						const extensions = [
							'ANGLE_instanced_arrays',
							'EXT_blend_minmax',
							'EXT_color_buffer_half_float',
							'EXT_disjoint_timer_query',
							'EXT_float_blend',
							'EXT_frag_depth',
							'EXT_shader_texture_lod',
							'EXT_texture_filter_anisotropic',
							'OES_element_index_uint',
							'OES_texture_float',
							'OES_texture_half_float',
							'OES_vertex_array_object',
							'WEBGL_color_buffer_float',
							'WEBGL_compressed_texture_s3tc',
							'WEBGL_debug_renderer_info',
							'WEBGL_depth_texture',
							'WEBGL_draw_buffers',
							'WEBGL_lose_context',
						];

						if (webglRandom.float(0, 1) > 0.5) {
							extensions.push('WEBGL_multi_draw');
						}

						return extensions;
					};
				}

				if (window.WebGL2RenderingContext) {
					const originalGetParameter2 = WebGL2RenderingContext.prototype.getParameter;

					WebGL2RenderingContext.prototype.getParameter = function (parameter) {
						if (parameter === 37445 || parameter === 37446) {
							const debugInfo = this.getExtension('WEBGL_debug_renderer_info');
							if (debugInfo) {
								if (parameter === debugInfo.UNMASKED_VENDOR_WEBGL) {
									return gpuInfo.vendor;
								}
								if (parameter === debugInfo.UNMASKED_RENDERER_WEBGL) {
									return gpuInfo.renderer;
								}
							}
						}

						if (standardParams.hasOwnProperty(parameter)) {
							return standardParams[parameter];
						}

						return originalGetParameter2.call(this, parameter);
					};
				}
			})();

			// ==================== Audio 指纹保护 ====================
			const protectAudio = (() => {
				const audioRandom = new SeededRandom(sessionSeed * 4);

				['AudioContext', 'webkitAudioContext'].forEach((contextName) => {
					if (window[contextName]) {
						const OriginalContext = window[contextName];

						const originalCreateAnalyser = OriginalContext.prototype.createAnalyser;
						OriginalContext.prototype.createAnalyser = function () {
							const analyser = originalCreateAnalyser.call(this);

							const originalGetFloatFrequencyData = analyser.getFloatFrequencyData;
							const originalGetByteFrequencyData = analyser.getByteFrequencyData;

							analyser.getFloatFrequencyData = function (array) {
								originalGetFloatFrequencyData.call(this, array);
								for (let i = 0; i < array.length; i++) {
									array[i] += audioRandom.float(-0.0001, 0.0001);
								}
							};

							analyser.getByteFrequencyData = function (array) {
								originalGetByteFrequencyData.call(this, array);
								for (let i = 0; i < array.length; i++) {
									array[i] = Math.min(255, Math.max(0, array[i] + audioRandom.int(-1, 1)));
								}
							};

							return analyser;
						};
					}
				});

				if (window.OfflineAudioContext) {
					const originalStartRendering = OfflineAudioContext.prototype.startRendering;

					OfflineAudioContext.prototype.startRendering = function () {
						return originalStartRendering.call(this).then((buffer) => {
							for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
								const data = buffer.getChannelData(channel);
								for (let i = 0; i < data.length; i++) {
									data[i] += audioRandom.float(-0.000001, 0.000001);
								}
							}
							return buffer;
						});
					};
				}
			})();

			// ==================== 屏幕和硬件信息保护 ====================
			const protectHardware = (() => {
				const hardwareRandom = new SeededRandom(sessionSeed * 5);

				const screenInfo = {
					width: selectedProfile.screen.width,
					height: selectedProfile.screen.height,
					availWidth: selectedProfile.screen.width,
					availHeight: selectedProfile.screen.height - hardwareRandom.int(30, 80),
					colorDepth: selectedProfile.screen.colorDepth,
					pixelDepth: selectedProfile.screen.colorDepth,
					availLeft: 0,
					availTop: 0,
					orientation: {
						angle: 0,
						type: 'landscape-primary',
						onchange: null,
					},
				};

				Object.keys(screenInfo).forEach((prop) => {
					try {
						Object.defineProperty(screen, prop, {
							get: () => screenInfo[prop],
							configurable: true,
						});
					} catch (e) {}
				});

				Object.defineProperty(window, 'devicePixelRatio', {
					get: () => {
						if (selectedProfile.screen.width > 1920) return 2;
						return 1 + hardwareRandom.float(0, 0.25);
					},
					configurable: true,
				});

				Object.defineProperty(navigator, 'hardwareConcurrency', {
					get: () => selectedProfile.hardware.cores,
					configurable: true,
				});

				if ('deviceMemory' in navigator) {
					Object.defineProperty(navigator, 'deviceMemory', {
						get: () => selectedProfile.hardware.memory,
						configurable: true,
					});
				}

				Object.defineProperty(navigator, 'maxTouchPoints', {
					get: () => {
						if (selectedProfile.platform === 'MacIntel') return 0;
						return hardwareRandom.choice([0, 1, 5, 10]);
					},
					configurable: true,
				});
			})();

			// ==================== 字体检测保护 ====================
			const protectFonts = (() => {
				const fontRandom = new SeededRandom(sessionSeed * 6);

				const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
				const originalOffsetWidth = Object.getOwnPropertyDescriptor(
					HTMLElement.prototype,
					'offsetWidth'
				);
				const originalOffsetHeight = Object.getOwnPropertyDescriptor(
					HTMLElement.prototype,
					'offsetHeight'
				);

				Element.prototype.getBoundingClientRect = function () {
					const rect = originalGetBoundingClientRect.call(this);

					if (this.style && (this.style.fontFamily || this.textContent)) {
						const noise = fontRandom.float(-0.005, 0.005);
						return new DOMRect(rect.x, rect.y, rect.width * (1 + noise), rect.height * (1 + noise));
					}

					return rect;
				};

				if (originalOffsetWidth && originalOffsetHeight) {
					Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
						get: function () {
							const width = originalOffsetWidth.get.call(this);
							if (this.style && this.style.fontFamily) {
								return width * (1 + fontRandom.float(-0.005, 0.005));
							}
							return width;
						},
					});

					Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
						get: function () {
							const height = originalOffsetHeight.get.call(this);
							if (this.style && this.style.fontFamily) {
								return height * (1 + fontRandom.float(-0.005, 0.005));
							}
							return height;
						},
					});
				}
			})();

			// ==================== 其他保护措施 ====================

			// 平台信息
			Object.defineProperty(navigator, 'platform', {
				get: () => selectedProfile.platform,
				configurable: true,
			});

			// // 时区和语言
			// Date.prototype.getTimezoneOffset = function () {
			// 	return selectedProfile.timezone;
			// };

			Object.defineProperty(navigator, 'languages', {
				get: () => [...selectedProfile.language],
				configurable: true,
			});

			Object.defineProperty(navigator, 'language', {
				get: () => selectedProfile.language[0],
				configurable: true,
			});

			// WebRTC 保护
			const RTCs = ['RTCPeerConnection', 'webkitRTCPeerConnection', 'mozRTCPeerConnection'];
			RTCs.forEach((name) => {
				if (window[name]) {
					const OriginalRTC = window[name];

					window[name] = function (config) {
						if (config && config.iceServers) {
							config.iceServers = [];
						}

						const pc = new OriginalRTC(config);

						const originalAddIceCandidate = pc.addIceCandidate;
						pc.addIceCandidate = function (candidate) {
							if (!candidate || !candidate.candidate) {
								return originalAddIceCandidate.call(this, candidate);
							}

							const ipRegex = /([0-9]{1,3}\\.){3}[0-9]{1,3}/g;
							const modifiedCandidate = {
								...candidate,
								candidate: candidate.candidate.replace(ipRegex, '10.0.0.1'),
							};

							return originalAddIceCandidate.call(this, modifiedCandidate);
						};

						return pc;
					};

					window[name].prototype = OriginalRTC.prototype;
				}
			});

			// 数学指纹保护
			// 先保存原始的 Math.sin，因为 SeededRandom 需要使用它
			const originalSin = Math.sin;

			// 创建随机数生成器，使用原始的 Math.sin
			class MathSeededRandom {
				constructor(seed) {
					this.seed = seed;
					this.counter = 0;
				}

				next() {
					this.counter++;
					const x = originalSin(this.seed * this.counter + this.counter) * 10000;
					return x - Math.floor(x);
				}

				float(min, max) {
					return this.next() * (max - min) + min;
				}
			}

			const mathRandom = new MathSeededRandom(sessionSeed * 7);
			const mathFunctions = [
				'acos',
				'acosh',
				'asin',
				'asinh',
				'atanh',
				'atan',
				'sin',
				'sinh',
				'cos',
				'cosh',
				'tan',
				'tanh',
				'exp',
				'expm1',
				'log1p',
			];

			mathFunctions.forEach((funcName) => {
				if (Math[funcName]) {
					const original = Math[funcName];
					Math[funcName] = function (x) {
						const result = original.call(this, x);
						return result + mathRandom.float(-1e-15, 1e-15);
					};
				}
			});

			// 插件列表保护
			const pluginsRandom = new SeededRandom(sessionSeed * 8);
			const pluginData = [
				{
					name: 'Chrome PDF Plugin',
					filename: 'internal-pdf-viewer',
					description: 'Portable Document Format',
				},
				{
					name: 'Chrome PDF Viewer',
					filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
					description: 'Portable Document Format',
				},
				{
					name: 'Native Client',
					filename: 'internal-nacl-plugin',
					description: 'Native Client Executable',
				},
			];

			const selectedPlugins = pluginData.filter(() => pluginsRandom.float(0, 1) > 0.3);

			try {
				Object.defineProperty(navigator, 'plugins', {
					get: () => {
						const arr = Object.create(PluginArray.prototype);
						selectedPlugins.forEach((plugin, i) => {
							arr[i] = {
								name: plugin.name,
								filename: plugin.filename,
								description: plugin.description,
								length: 1,
								[0]: {
									type: 'application/pdf',
									suffixes: 'pdf',
									description: plugin.description,
								},
								item: function (i) {
									return this[i];
								},
								namedItem: function () {
									return this[0];
								},
							};
						});
						arr.length = selectedPlugins.length;
						arr.item = function (i) {
							return this[i];
						};
						arr.namedItem = function (name) {
							return selectedPlugins.find((p) => p.name === name) || null;
						};
						arr.refresh = function () {};
						return arr;
					},
					configurable: true,
				});
			} catch (e) {}

			// 性能 API 保护
			const perfRandom = new SeededRandom(sessionSeed * 9);
			const originalNow = performance.now;
			performance.now = function () {
				const time = originalNow.call(this);
				return Math.round(time * 10) / 10 + perfRandom.float(0, 0.1);
			};

			// 电池 API
			if (navigator.getBattery) {
				const batteryRandom = new SeededRandom(sessionSeed * 10);
				navigator.getBattery = function () {
					return Promise.resolve({
						charging: batteryRandom.choice([true, false]),
						chargingTime: batteryRandom.choice([0, Infinity]),
						dischargingTime: Infinity,
						level: batteryRandom.float(0.5, 1),
						addEventListener: () => {},
						removeEventListener: () => {},
						dispatchEvent: () => true,
					});
				};
			}

			// ==================== 调试输出 ====================
			if (CONFIG.debug) {
				const styles = {
					header:
						'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 5px 10px; font-weight: bold; font-size: 14px; border-radius: 4px;',
					success: 'color: #10b981; font-weight: bold;',
					info: 'color: #3b82f6;',
					warning: 'color: #f59e0b;',
					section: 'color: #8b5cf6; font-weight: bold;',
				};

				console.log('%c🛡️ Playwright 反指纹保护已启动', styles.header);
				console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', styles.info);
				console.log('%c📌 会话种子: ' + sessionSeed.toFixed(6), styles.warning);
				console.log(
					'%c🔄 跨标签页一致性: ' + (CONFIG.crossTabConsistency ? '启用' : '禁用'),
					styles.success
				);
				console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', styles.info);

				console.log('%c设备配置:', styles.section);
				console.log('%c  平台: ' + selectedProfile.platform, styles.info);
				console.log(
					'%c  屏幕: ' + selectedProfile.screen.width + 'x' + selectedProfile.screen.height,
					styles.info
				);
				console.log('%c  GPU: ' + selectedProfile.gpu.renderer, styles.info);
				console.log('%c  CPU核心: ' + selectedProfile.hardware.cores, styles.info);
				console.log('%c  内存: ' + selectedProfile.hardware.memory + 'GB', styles.info);

				// 测试函数
				window.__testFingerprint = function () {
					console.log('%c正在测试指纹保护...', styles.section);
					console.log('Session Seed:', sessionSeed);
					console.log('Canvas Noise Sample:', new SeededRandom(sessionSeed * 2).float(-1, 1));
					if (CONFIG.crossTabConsistency) {
						console.log(
							'Session Seed (localStorage):',
							localStorage.getItem('__fp_cross_tab_seed')
						);
						console.log(
							'Last Heartbeat:',
							new Date(parseInt(localStorage.getItem('__fp_heartbeat'))).toLocaleTimeString()
						);
					}
				};
			}
		}, configData);
	}

	/**
	 * 应用到 Playwright 浏览器上下文
	 * @param {BrowserContext} context - Playwright 浏览器上下文
	 */
	async apply(context) {
		// 注入反指纹脚本到所有页面

		await this.injectionScript(context);

		// 设置额外的 HTTP 头
		const headers = {};

		// 设置用户代理
		if (this.selectedProfile.userAgent) {
			headers['User-Agent'] = this.selectedProfile.userAgent;
		}

		// 设置语言
		if (this.selectedProfile.language) {
			headers['Accept-Language'] = this.selectedProfile.language.join(',');
		}

		if (Object.keys(headers).length > 0) {
			await context.setExtraHTTPHeaders(headers);
		}

		if (this.options.debug) {
			console.log('✅ Playwright 反指纹插件已应用');
			console.log('📌 会话种子:', this.sessionSeed);
			console.log('🖥️ 设备配置:', this.selectedProfile.platform);
		}
	}

	/**
	 * 获取当前会话信息
	 */
	getSessionInfo() {
		return {
			sessionSeed: this.sessionSeed,
			selectedProfile: this.selectedProfile,
			crossTabConsistency: this.options.crossTabConsistency,
		};
	}

	/**
	 * 创建预设配置
	 */
	static createPreset(preset = 'default') {
		const presets = {
			// 默认配置 - 完整保护
			default: {
				debug: false,
				crossTabConsistency: true,
			},

			// 调试模式 - 显示详细日志
			debug: {
				debug: true,
				crossTabConsistency: true,
			},

			// 单页面模式 - 不使用跨标签页一致性
			single: {
				debug: false,
				crossTabConsistency: false,
			},

			// 最小化配置 - 仅基本保护
			minimal: {
				debug: false,
				crossTabConsistency: false,
				heartbeatInterval: 5000,
				sessionTimeout: 10000,
			},
		};

		return new PlaywrightAntiFingerprintPlugin(presets[preset] || presets.default);
	}

	/**
	 * 获取反自动化检测的浏览器启动参数
	 * @returns {string[]} 启动参数数组
	 */
	static getStealthArgs() {
		return [
			'--disable-blink-features=AutomationControlled', // 禁用自动化控制特征
			'--disable-dev-shm-usage',
			'--disable-setuid-sandbox',
			'--no-sandbox',
			'--disable-infobars',
			'--disable-background-timer-throttling',
			'--disable-backgrounding-occluded-windows',
			'--disable-renderer-backgrounding',
			'--disable-features=IsolateOrigins,site-per-process',
			'--disable-popup-blocking',
		];
	}

	/**
	 * 获取需要忽略的默认参数
	 * @returns {string[]} 要忽略的参数数组
	 */
	static getIgnoreDefaultArgs() {
		return ['--enable-automation'];
	}

	/**
	 * 获取完整的浏览器启动配置
	 * 用于 browser.launch() 或 chromium.launchPersistentContext()
	 * @param {object} options - 额外的配置选项
	 * @returns {object} 浏览器启动配置对象
	 */
	static getLaunchOptions(options = {}) {
		return {
			headless: false, // 建议使用有头模式，更难被检测
			args: PlaywrightAntiFingerprintPlugin.getStealthArgs(),
			ignoreDefaultArgs: PlaywrightAntiFingerprintPlugin.getIgnoreDefaultArgs(),
			viewport: { width: 1920, height: 1080 },
			permissions: ['geolocation', 'notifications'],
			deviceScaleFactor: 1,
			isMobile: false,
			hasTouch: false,
			bypassCSP: true,
			acceptDownloads: true,
			colorScheme: 'light',
			...options,
		};
	}
}

// 导出便捷函数
export function createAntiFingerprintPlugin(options) {
	return new PlaywrightAntiFingerprintPlugin(options);
}

// 默认导出
export default PlaywrightAntiFingerprintPlugin;
