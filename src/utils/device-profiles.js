/**
 * 浏览器指纹 - 设备配置文件库
 * 用于模拟多样化的真实设备环境
 */

/**
 * 默认设备配置文件
 * 包含不同操作系统、硬件配置、GPU、屏幕分辨率等
 */
export const DEFAULT_DEVICE_PROFILES = [
	// ========== Windows 设备 ==========

	// 1. 主流办公本 - Intel 核显
	{
		platform: 'Win32',
		userAgent:
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
		screen: { width: 1920, height: 1080, colorDepth: 24 },
		hardware: { cores: 4, memory: 8 },
		gpu: { vendor: 'Intel Inc.', renderer: 'Intel(R) UHD Graphics 620' },
		language: ['zh-CN', 'zh', 'en-US', 'en'],
	},

	// 2. 入门游戏本 - NVIDIA GTX
	{
		platform: 'Win32',
		userAgent:
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
		screen: { width: 1920, height: 1080, colorDepth: 24 },
		hardware: { cores: 8, memory: 16 },
		gpu: { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce GTX 1660 Ti' },
		language: ['zh-CN', 'zh', 'en-US', 'en'],
	},

	// 3. 高端游戏本 - NVIDIA RTX
	{
		platform: 'Win32',
		userAgent:
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
		screen: { width: 2560, height: 1440, colorDepth: 24 },
		hardware: { cores: 12, memory: 32 },
		gpu: { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce RTX 3070' },
		language: ['zh-CN', 'zh', 'en-US', 'en'],
	},
];

/**
 * 获取随机设备配置
 * @param {number} seed - 随机种子（可选）
 * @returns {object} 设备配置对象
 */
export function getRandomProfile(seed) {
	const index = seed
		? Math.floor(seed * DEFAULT_DEVICE_PROFILES.length)
		: Math.floor(Math.random() * DEFAULT_DEVICE_PROFILES.length);
	return DEFAULT_DEVICE_PROFILES[index % DEFAULT_DEVICE_PROFILES.length];
}

/**
 * 根据平台筛选设备配置
 * @param {string} platform - 'Win32' | 'MacIntel' | 'Linux x86_64'
 * @returns {array} 符合条件的设备配置数组
 */
export function getProfilesByPlatform(platform) {
	return DEFAULT_DEVICE_PROFILES.filter((profile) => profile.platform === platform);
}

/**
 * 获取配置统计信息
 * @returns {object} 统计信息
 */
export function getProfileStats() {
	const stats = {
		total: DEFAULT_DEVICE_PROFILES.length,
		byPlatform: {},
		byGpuVendor: {},
		chromeVersions: new Set(),
	};

	DEFAULT_DEVICE_PROFILES.forEach((profile) => {
		// 按平台统计
		stats.byPlatform[profile.platform] = (stats.byPlatform[profile.platform] || 0) + 1;

		// 按 GPU 厂商统计
		stats.byGpuVendor[profile.gpu.vendor] = (stats.byGpuVendor[profile.gpu.vendor] || 0) + 1;

		// 收集 Chrome 版本
		const match = profile.userAgent.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/);
		if (match) {
			stats.chromeVersions.add(match[1]);
		}
	});

	stats.chromeVersions = Array.from(stats.chromeVersions).sort();

	return stats;
}

// 默认导出
export default DEFAULT_DEVICE_PROFILES;
