/**
 * Playwright 反检测插件 - 完整版
 * 包含所有14个反检测措施
 */

/**
 * 完整的反检测脚本（14个措施）
 */
const stealthScript = () => {
    // 1. 删除 webdriver 属性
    delete Object.getPrototypeOf(navigator).webdriver;
    Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
    });

    // 2. 修复 Chrome 对象
    if (!window.chrome) {
        window.chrome = {};
    }
    window.chrome.runtime = {
        connect: () => {},
        sendMessage: () => {},
        onMessage: {
            addListener: () => {},
            removeListener: () => {},
            hasListener: () => false
        },
        getURL: () => '',
        id: 'dfhodfhdfhdfhdfhdfhdfhdfhdfhdfhdf',
        onConnect: {
            addListener: () => {},
            removeListener: () => {},
            hasListener: () => false
        },
        onMessageExternal: {
            addListener: () => {},
            removeListener: () => {},
            hasListener: () => false
        }
    };
    window.chrome.loadTimes = () => ({
        commitLoadTime: Date.now() / 1000,
        connectionInfo: 'http/1.1',
        finishDocumentLoadTime: Date.now() / 1000,
        finishLoadTime: Date.now() / 1000,
        firstPaintAfterLoadTime: 0,
        firstPaintTime: Date.now() / 1000,
        navigationType: 'Other',
        npnNegotiatedProtocol: 'http/1.1',
        redirectCount: 0,
        requestTime: Date.now() / 1000,
        startLoadTime: Date.now() / 1000,
        wasAlternateProtocolAvailable: false,
        wasFetchedViaSpdy: false,
        wasNpnNegotiated: true
    });
    window.chrome.csi = () => ({});
    window.chrome.app = {
        isInstalled: false
    };

    // 3. Navigator 属性修复
    Object.defineProperties(navigator, {
        platform: { get: () => 'Win32' },
        vendor: { get: () => 'Google Inc.' },
        productSub: { get: () => '20030107' },
        maxTouchPoints: { get: () => 0 },
        hardwareConcurrency: { get: () => 8 },
        deviceMemory: { get: () => 8 },
        connection: {
            get: () => ({
                effectiveType: '4g',
                rtt: 50,
                downlink: 10,
                saveData: false
            })
        }
    });

    // 4. 插件列表
    Object.defineProperty(navigator, 'plugins', {
        get: () => {
            const pluginArray = [
                {
                    name: 'PDF Viewer',
                    description: 'Portable Document Format',
                    filename: 'internal-pdf-viewer',
                    length: 2,
                    0: { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
                    1: { type: 'text/pdf', suffixes: 'pdf', description: 'Portable Document Format' }
                },
                {
                    name: 'Chrome PDF Viewer',
                    description: 'Portable Document Format',
                    filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
                    length: 2,
                    0: { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
                    1: { type: 'text/pdf', suffixes: 'pdf', description: 'Portable Document Format' }
                },
                {
                    name: 'Native Client',
                    description: 'Native Client Executable',
                    filename: 'internal-nacl-plugin',
                    length: 2,
                    0: { type: 'application/x-nacl', suffixes: 'nexe', description: 'Native Client Executable' },
                    1: { type: 'application/x-pnacl', suffixes: 'pexe', description: 'Portable Native Client Executable' }
                }
            ];
            pluginArray.length = 3;
            return pluginArray;
        }
    });

    // 5. 语言设置
    Object.defineProperty(navigator, 'languages', {
        get: () => ['zh-CN', 'zh', 'en-US', 'en']
    });
    Object.defineProperty(navigator, 'language', {
        get: () => 'zh-CN'
    });

    // 6. Permissions API
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => {
        if (parameters.name === 'notifications') {
            return Promise.resolve({ state: Notification.permission });
        }
        return originalQuery(parameters);
    };

    // 7. WebGL Vendor 和 Renderer
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) {
            return 'Intel Inc.';
        }
        if (parameter === 37446) {
            return 'Intel(R) Iris(R) Xe Graphics';
        }
        return getParameter.apply(this, arguments);
    };

    const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
    WebGL2RenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) {
            return 'Intel Inc.';
        }
        if (parameter === 37446) {
            return 'Intel(R) Iris(R) Xe Graphics';
        }
        return getParameter2.apply(this, arguments);
    };

    // 8. 修复 toString 方法
    const nativeToStringFunctionString = Function.prototype.toString.call(Function.prototype.toString);
    Function.prototype.toString = new Proxy(Function.prototype.toString, {
        apply: function (target, thisArg, args) {
            if (thisArg === window.navigator.permissions.query) {
                return 'function query() { [native code] }';
            }
            if (thisArg && thisArg.name === 'sendMessage') {
                return 'function sendMessage() { [native code] }';
            }
            if (thisArg === Function.prototype.toString) {
                return nativeToStringFunctionString;
            }
            return target.apply(thisArg, args);
        }
    });

    // 9. 隐藏自动化痕迹
    Object.defineProperty(document, 'hidden', {
        get: () => false
    });
    Object.defineProperty(document, 'visibilityState', {
        get: () => 'visible'
    });

    // 10. 电池 API
    if (navigator.getBattery) {
        navigator.getBattery = () => Promise.resolve({
            charging: true,
            chargingTime: 0,
            dischargingTime: Infinity,
            level: 1,
            addEventListener: () => {},
            removeEventListener: () => {}
        });
    }

    // 11. 修复 Notification
    if (!window.Notification) {
        window.Notification = {
            permission: 'default',
            requestPermission: () => Promise.resolve('default')
        };
    }

    // 12. 修复媒体设备
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const originalEnumerateDevices = navigator.mediaDevices.enumerateDevices;
        navigator.mediaDevices.enumerateDevices = () => {
            return originalEnumerateDevices.call(navigator.mediaDevices).then(devices => {
                return devices.filter(device => device.kind !== 'audioinput' && device.kind !== 'videoinput');
            });
        };
    }

    // 13. 屏幕分辨率
    Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
    Object.defineProperty(screen, 'availHeight', { get: () => 1040 });
    Object.defineProperty(screen, 'width', { get: () => 1920 });
    Object.defineProperty(screen, 'height', { get: () => 1080 });
    Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
    Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });

    // 14. 时区偏移
    Date.prototype.getTimezoneOffset = () => -480; // 中国时区 UTC+8

    console.log('[反检测] 所有反检测措施已应用');
};

/**
 * 应用反检测到浏览器上下文
 * @param {BrowserContext} context - Playwright 浏览器上下文
 */
export async function applyStealthToContext(context) {
    await context.addInitScript(stealthScript);
}

/**
 * 获取反检测浏览器启动参数
 */
export function getStealthArgs() {
    return [
        // 基础反检测参数
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--disable-notifications',

        // 窗口设置
        '--window-size=1920,1080',
        '--start-maximized',

        // 渲染相关
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials',
        '--flag-switches-begin',
        '--disable-features=AutomationControlled',
        '--flag-switches-end',

        // Chrome 特性
        '--disable-features=ChromeWhatsNewUI',
        '--disable-features=OptimizationHints',
        '--disable-features=Translate',
        '--disable-features=MediaRouter',

        // 性能相关
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=BackForwardCache',

        // GPU 和图形
        '--use-angle=default',
        '--enable-features=NetworkService,NetworkServiceInProcess',

        // 用户代理
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];
}

/**
 * 需要忽略的默认参数
 */
export function getIgnoreDefaultArgs() {
    return ['--enable-automation', '--enable-blink-features=AutomationControlled'];
}

export default { applyStealthToContext, getStealthArgs, getIgnoreDefaultArgs };