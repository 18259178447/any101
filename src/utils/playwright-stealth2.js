/**
 * Playwright 反检测插件 - LinuxDo 优化版
 * 基于 checkin-linuxdo.js 中验证有效的反检测配置
 */

/**
 * LinuxDo 场景优化的反检测脚本
 * 保留核心的反检测措施，去除冗余配置
 */
const stealthScript = () => {
	// 1. 覆盖 navigator.webdriver - 最关键的反检测
	Object.defineProperty(navigator, 'webdriver', {
		get: () => false,
	});

	// 2. 覆盖 Chrome 对象 - 模拟真实浏览器
	window.chrome = {
		runtime: {},
	};

	// 3. 覆盖 permissions - 处理通知权限查询
	const originalQuery = window.navigator.permissions.query;
	window.navigator.permissions.query = (parameters) =>
		parameters.name === 'notifications'
			? Promise.resolve({ state: Notification.permission })
			: originalQuery(parameters);

	// 4. 模拟插件 - 提供真实浏览器的插件列表
	Object.defineProperty(navigator, 'plugins', {
		get: () => [
			{
				0: {
					type: 'application/x-google-chrome-pdf',
					suffixes: 'pdf',
					description: 'Portable Document Format',
					enabledPlugin: Plugin,
				},
				description: 'Portable Document Format',
				filename: 'internal-pdf-viewer',
				length: 1,
				name: 'Chrome PDF Plugin',
			},
			{
				0: {
					type: 'application/x-nacl',
					suffixes: '',
					description: 'Native Client Executable',
					enabledPlugin: Plugin,
				},
				description: 'Native Client Executable',
				filename: 'internal-nacl-plugin',
				length: 2,
				name: 'Native Client',
			},
		],
	});

	// 5. 模拟语言环境
	Object.defineProperty(navigator, 'languages', {
		get: () => ['zh-CN', 'zh', 'en-US', 'en'],
	});

	// 6. 覆盖 platform - Windows 平台
	Object.defineProperty(navigator, 'platform', {
		get: () => 'Win32',
	});

	// 7. 模拟硬件信息
	Object.defineProperty(navigator, 'hardwareConcurrency', {
		get: () => 8,
	});

	// 8. 模拟设备内存
	Object.defineProperty(navigator, 'deviceMemory', {
		get: () => 8,
	});
};

/**
 * 应用反检测脚本到页面
 * @param {Page} page - Playwright 页面对象
 */
export async function applyStealthToPage(page) {
	await page.addInitScript(stealthScript);
}

/**
 * 获取 LinuxDo 场景优化的浏览器启动参数
 * 基于 checkin-linuxdo.js 中验证有效的配置
 * @returns {string[]} 启动参数数组
 */
export function getStealthArgs() {
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
 * 需要忽略的默认参数
 * @returns {string[]} 要忽略的参数数组
 */
export function getIgnoreDefaultArgs() {
	return ['--enable-automation'];
}

/**
 * 获取推荐的浏览器上下文配置
 * 适用于 launchPersistentContext
 * @param {string} userDataDir - 用户数据目录
 * @returns {object} 浏览器上下文配置对象
 */
export function getPersistentContextOptions(userDataDir, options = {}) {
	return {
		headless: false, // 建议使用有头模式，更难被检测
		args: getStealthArgs(),
		ignoreDefaultArgs: getIgnoreDefaultArgs(),
		userAgent:
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
		viewport: { width: 1920, height: 1080 },
		locale: 'zh-CN',
		timezoneId: 'Asia/Shanghai',
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

// 默认导出
export default {
	applyStealthToPage,
	getStealthArgs,
	getIgnoreDefaultArgs,
	getPersistentContextOptions,
};
