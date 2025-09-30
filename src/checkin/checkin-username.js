/**
 * AnyRouter 登录签到模块
 * 通过页面登录方式获取 session 和 api_user
 */

import { chromium } from 'playwright';

class AnyRouterSignIn {
	constructor() {
		this.baseUrl = 'https://anyrouter.top';
	}

	/**
	 * 生成随机延迟时间（模拟真人操作）
	 */
	getRandomDelay(min = 500, max = 1500) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	/**
	 * 等待随机时间
	 */
	async randomDelay(min = 500, max = 1500) {
		const delay = this.getRandomDelay(min, max);
		await new Promise(resolve => setTimeout(resolve, delay));
	}

	/**
	 * 通过页面登录获取 session 和 api_user
	 * @param {string} username - 用户名或邮箱
	 * @param {string} password - 密码
	 * @returns {Object|null} - { session: string, apiUser: string, userInfo: object }
	 */
	async loginAndGetSession(username, password) {
		console.log(`[登录签到] 开始处理账号: ${username}`);

		let browser = null;
		let context = null;
		let page = null;

		try {
			// 启动浏览器（使用独立的浏览器实例，避免账号间相互影响）
			console.log('[浏览器] 启动 Chromium 浏览器（独立实例）...');

			// 使用 launch 而不是 launchPersistentContext，创建全新的浏览器实例
			browser = await chromium.launch({
				headless: true, // 无头模式运行，适合服务器环境
				args: [
					'--disable-blink-features=AutomationControlled',
					'--disable-dev-shm-usage',
					'--disable-web-security',
					'--disable-features=VizDisplayCompositor',
					'--no-sandbox'
				]
			});

			// 创建新的隐身模式上下文（每个上下文独立，不共享cookies等数据）
			context = await browser.newContext({
				userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
				viewport: { width: 1920, height: 1080 },
				locale: 'zh-CN',
				timezoneId: 'Asia/Shanghai',
				ignoreHTTPSErrors: true,
				// 确保每个账号使用独立的存储
				storageState: undefined
			});

			page = await context.newPage();

			// 设置请求拦截，监听登录和签到接口
			let loginResponse = null;
			let signInResponse = null;
			let userSelfResponse = null;
			let sessionCookie = null;

			// 创建 Promise 用于等待 /api/user/self 响应
			let userSelfResolve;
			const userSelfPromise = new Promise((resolve) => {
				userSelfResolve = resolve;
			});

			page.on('response', async response => {
				const url = response.url();

				// 监听登录接口响应
				if (url.includes('/api/user/login')) {
					console.log('[网络] 捕获登录接口响应');
					loginResponse = await response.json().catch(() => null);

					// 获取 Set-Cookie 头中的 session
					const headers = response.headers();
					const setCookieHeader = headers['set-cookie'];
					if (setCookieHeader) {
						const sessionMatch = setCookieHeader.match(/session=([^;]+)/);
						if (sessionMatch) {
							sessionCookie = sessionMatch[1];
							console.log('[成功] 获取到 session cookie');
						}
					}
				}

				// 监听签到接口响应
				if (url.includes('/api/user/sign_in')) {
					console.log('[网络] 捕获签到接口响应');
					signInResponse = await response.json().catch(() => null);
				}

				// 监听用户信息接口响应
				if (url.includes('/api/user/self')) {
					console.log('[网络] 捕获用户信息接口响应');
					userSelfResponse = await response.json().catch(() => null);
					userSelfResolve(true); // 通知已收到响应
				}
			});

			// 步骤1: 访问登录页面
			console.log('[页面] 访问登录页面...');
			await page.goto(`${this.baseUrl}/login`, {
				waitUntil: 'networkidle',
				timeout: 30000
			});

			// 等待页面加载完成
			await this.randomDelay(1000, 2000);

			// 步骤2: 检查并关闭系统公告弹窗
			console.log('[检查] 检测系统公告弹窗...');
			try {
				// 等待弹窗出现（最多等3秒）
				const dialogSelector = 'div[role="dialog"]';
				await page.waitForSelector(dialogSelector, { timeout: 3000 });

				console.log('[弹窗] 发现系统公告，准备关闭...');
				await this.randomDelay(500, 1000);

				// 尝试点击"关闭公告"按钮
				const closeButton = page.getByRole('button', { name: '关闭公告' });
				if (await closeButton.isVisible()) {
					await closeButton.click();
					console.log('[弹窗] 已关闭系统公告');
					await this.randomDelay(500, 1000);
				}
			} catch (e) {
				console.log('[弹窗] 未发现系统公告弹窗');
			}

			// 步骤3: 输入用户名
			console.log('[输入] 填写用户名...');
			const usernameInput = page.getByRole('textbox', { name: '用户名或邮箱' });
			await usernameInput.click();
			await this.randomDelay(300, 600);

			// 模拟逐字输入
			for (const char of username) {
				await page.keyboard.type(char);
				await this.randomDelay(50, 150);
			}

			// 步骤4: 输入密码
			console.log('[输入] 填写密码...');
			const passwordInput = page.getByRole('textbox', { name: '密码' });
			await passwordInput.click();
			await this.randomDelay(300, 600);

			// 模拟逐字输入密码
			for (const char of password) {
				await page.keyboard.type(char);
				await this.randomDelay(50, 150);
			}

			await this.randomDelay(500, 1000);

			// 步骤5: 点击登录按钮
			console.log('[登录] 点击登录按钮...');
			const loginButton = page.getByRole('button', { name: '继续' });
			await loginButton.click();

			// 步骤6: 等待页面跳转和签到完成
			console.log('[等待] 等待登录和签到完成...');

			// 等待跳转到控制台页面
			await page.waitForURL('**/console', {
				timeout: 15000,
				waitUntil: 'networkidle'
			});

			console.log('[成功] 登录成功，已跳转到控制台');

			// 等待 /api/user/self 接口响应（最多等待 10 秒）
			console.log('[等待] 等待用户信息接口响应...');
			const userSelfReceived = await Promise.race([
				userSelfPromise,
				new Promise(resolve => setTimeout(() => resolve(false), 10000))
			]);

			if (!userSelfReceived) {
				console.log('[警告] 等待 /api/user/self 接口超时，将使用备用方案');
			}

			// 步骤7: 获取用户信息
			console.log('[提取] 提取用户信息和 session...');

			// 优先使用 /api/user/self 接口返回的数据
			let userData = null;
			let apiUser = null;

			if (userSelfResponse && userSelfResponse.data) {
				userData = userSelfResponse.data;
				apiUser = userData.id ? String(userData.id) : null;
				console.log(`[信息] 用户ID (api_user): ${apiUser}`);
				console.log(`[信息] 用户名: ${userData.username}`);
				console.log(`[信息] 邮箱: ${userData.email}`);
				console.log(`[信息] 余额: $${(userData.quota / 500000).toFixed(2)}`);
				console.log(`[信息] 已使用: $${(userData.used_quota / 500000).toFixed(2)}`);
				console.log(`[信息] 推广码: ${userData.aff_code}`);
			} else {
				// 备用方案：从 localStorage 获取用户信息
				console.log('[信息] 未捕获到 /api/user/self 响应，尝试从 localStorage 获取');
				const userDataStr = await page.evaluate(() => {
					return localStorage.getItem('user');
				});

				if (userDataStr) {
					try {
						userData = JSON.parse(userDataStr);
						apiUser = userData.id ? String(userData.id) : null;
						console.log(`[信息] 用户ID (api_user): ${apiUser}`);
						console.log(`[信息] 用户名: ${userData.username}`);
						console.log(`[警告] localStorage 数据可能不准确，建议使用 /api/user/self 接口数据`);
					} catch (e) {
						console.log('[错误] 解析用户数据失败');
					}
				}
			}

			// 获取当前页面的所有 cookies
			const cookies = await context.cookies();
			const sessionCookieFromPage = cookies.find(c => c.name === 'session');

			if (sessionCookieFromPage) {
				sessionCookie = sessionCookieFromPage.value;
				console.log('[成功] 从页面 cookies 获取到 session');
			}

			// 检查签到结果
			if (signInResponse) {
				if (signInResponse.success || signInResponse.ret === 1) {
					console.log('[签到] 自动签到成功！');
				} else {
					const msg = signInResponse.msg || signInResponse.message || '未知原因';
					console.log(`[签到] 签到状态: ${msg}`);
				}
			}

			// 返回结果
			if (sessionCookie && apiUser) {
				console.log('[成功] 成功获取 session 和 api_user');
				return {
					session: sessionCookie,
					apiUser: apiUser,
					userInfo: userData
				};
			} else {
				console.log('[失败] 未能获取完整的认证信息');
				console.log(`  - session: ${sessionCookie ? '✓' : '✗'}`);
				console.log(`  - api_user: ${apiUser ? '✓' : '✗'}`);
				return null;
			}

		} catch (error) {
			console.log(`[错误] 登录过程发生错误: ${error.message}`);
			return null;
		} finally {
			// 确保清理资源
			try {
				if (page) await page.close();
				if (context) await context.close();
				if (browser) await browser.close();
			} catch (cleanupError) {
				console.log(`[警告] 清理浏览器资源时出错: ${cleanupError.message}`);
			}
		}
	}

	/**
	 * 批量处理多个账号
	 * @param {Array} accounts - 账号数组 [{username: '', password: ''}, ...]
	 * @returns {Array} - 结果数组
	 */
	async processAccounts(accounts) {
		const results = [];

		for (let i = 0; i < accounts.length; i++) {
			const account = accounts[i];
			console.log(`\n[处理] 开始处理账号 ${i + 1}/${accounts.length}`);

			const result = await this.loginAndGetSession(
				account.username,
				account.password
			);

			results.push({
				username: account.username,
				success: result !== null,
				data: result
			});

			// 账号之间添加延迟，避免频繁操作
			if (i < accounts.length - 1) {
				console.log('[等待] 等待 5 秒后处理下一个账号...');
				await this.randomDelay(5000, 7000);
			}
		}

		return results;
	}
}

// 导出模块
export default AnyRouterSignIn;

// 如果直接运行此文件，执行示例代码
if (import.meta.url === `file://${process.argv[1]}`) {
	(async () => {
		const signin = new AnyRouterSignIn();

		// 示例：单个账号登录
		console.log('===== AnyRouter 登录签到测试 =====\n');

		// 从环境变量或命令行参数获取账号信息
		const username = '757916814494';
		const password = '757916814494';

		const result = await signin.loginAndGetSession(username, password);

		if (result) {
			console.log('\n===== 登录成功，获取到以下信息 =====');
			console.log(`Session: ${result.session.substring(0, 50)}...`);
			console.log(`API User: ${result.apiUser}`);
			console.log(`用户名: ${result.userInfo?.username}`);
			console.log(`余额: $${(result.userInfo?.quota / 500000).toFixed(2)}`);
		} else {
			console.log('\n===== 登录失败 =====');
		}
	})();
}