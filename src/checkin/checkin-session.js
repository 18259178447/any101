/**
 * AnyRouter Session 签到模块
 * 直接使用 session 和 api_user 进行签到
 */

import { chromium } from 'playwright';
import axios from 'axios';
import { createHTTP2Adapter } from 'axios-http2-adapter';
import { fileURLToPath } from 'url';

class AnyRouterSessionSignIn {
	constructor(baseUrl = 'https://anyrouter.top') {
		this.baseUrl = baseUrl;
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
		await new Promise((resolve) => setTimeout(resolve, delay));
	}

	/**
	 * 使用 Playwright 获取 WAF cookies
	 * @returns {Object|null} - WAF cookies 对象
	 */
	async getWafCookies() {
		console.log('[处理中] 启动浏览器获取 WAF cookies...');

		let context = null;
		let page = null;

		try {
			// 启动浏览器（使用持久化上下文）
			context = await chromium.launchPersistentContext('', {
				headless: true,
				userAgent:
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
				viewport: { width: 1920, height: 1080 },
				args: [
					'--disable-blink-features=AutomationControlled',
					'--disable-dev-shm-usage',
					'--disable-web-security',
					'--disable-features=VizDisplayCompositor',
					'--no-sandbox',
				],
			});

			page = await context.newPage();

			console.log('[处理中] 访问登录页获取初始 cookies...');
			await page.goto(`${this.baseUrl}/login`, {
				waitUntil: 'networkidle',
				timeout: 30000,
			});

			// 等待页面完全加载
			try {
				await page.waitForFunction('document.readyState === "complete"', { timeout: 5000 });
			} catch {
				await this.randomDelay(3000, 3000);
			}

			// 获取 cookies
			const cookies = await context.cookies();
			const wafCookies = {};

			for (const cookie of cookies) {
				if (['acw_tc', 'cdn_sec_tc', 'acw_sc__v2'].includes(cookie.name)) {
					wafCookies[cookie.name] = cookie.value;
				}
			}

			console.log(`[信息] 获取到 ${Object.keys(wafCookies).length} 个 WAF cookies`);

			// 检查必需的 cookies
			const requiredCookies = ['acw_tc', 'cdn_sec_tc', 'acw_sc__v2'];
			const missingCookies = requiredCookies.filter((c) => !wafCookies[c]);

			if (missingCookies.length > 0) {
				console.log(`[失败] 缺少 WAF cookies: ${missingCookies.join(', ')}`);
				await context.close();
				return null;
			}

			console.log('[成功] 成功获取所有 WAF cookies');
			await context.close();

			return wafCookies;
		} catch (error) {
			console.log(`[失败] 获取 WAF cookies 时发生错误: ${error.message}`);
			if (context) await context.close();
			return null;
		}
	}

	/**
	 * 获取用户信息
	 * @param {Object} cookies - cookies 对象
	 * @param {string} apiUser - API User ID
	 * @returns {Object|null} - 用户信息
	 */
	async getUserInfo(cookies, apiUser) {
		try {
			const cookieString = Object.entries(cookies)
				.map(([key, value]) => `${key}=${value}`)
				.join('; ');

			// 使用 HTTP/2
			const axiosInstance = axios.create({
				adapter: createHTTP2Adapter({
					force: true,
				}),
			});

			const response = await axiosInstance.get(`${this.baseUrl}/api/user/self`, {
				headers: {
					Cookie: cookieString,
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
					Accept: 'application/json, text/plain, */*',
					'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
					'Accept-Encoding': 'gzip, deflate, br, zstd',
					Referer: `${this.baseUrl}/console`,
					Origin: this.baseUrl,
					Connection: 'keep-alive',
					'Sec-Fetch-Dest': 'empty',
					'Sec-Fetch-Mode': 'cors',
					'Sec-Fetch-Site': 'same-origin',
					'new-api-user': apiUser,
				},
				timeout: 30000,
			});

			if (response.status === 200 && response.data.success) {
				const userData = response.data.data || {};
				return {
					username: userData.username,
					email: userData.email,
					quota: userData.quota,
					usedQuota: userData.used_quota,
					affCode: userData.aff_code,
				};
			}
			return null;
		} catch (error) {
			console.log(`[失败] 获取用户信息失败: ${error.message.substring(0, 50)}...`);
			return null;
		}
	}

	/**
	 * 使用 session 和 api_user 执行签到（使用 Playwright）
	 * @param {string} session - Session cookie 值
	 * @param {string} apiUser - API User ID
	 * @returns {Object|null} - 签到结果 { success: boolean, userInfo: object }
	 */
	async signIn(session, apiUser) {
		console.log(`\n[签到] 开始处理 Session 签到 (API User: ${apiUser})`);

		let context = null;
		let page = null;

		try {
			// 启动浏览器
			console.log('[浏览器] 启动浏览器...');
			context = await chromium.launchPersistentContext('', {
				headless: true,
				userAgent:
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
				viewport: { width: 1920, height: 1080 },
				args: [
					'--disable-blink-features=AutomationControlled',
					'--disable-dev-shm-usage',
					'--disable-web-security',
					'--disable-features=VizDisplayCompositor',
					'--no-sandbox',
				],
			});

			page = await context.newPage();

			// 设置 cookies
			console.log('[Cookie] 设置 session cookie...');
			await context.addCookies([
				{
					name: 'session',
					value: session,
					domain: new URL(this.baseUrl).hostname,
					path: '/',
					httpOnly: true,
					secure: true,
					sameSite: 'Lax',
				},
			]);

			// 访问登录页以获取 WAF cookies
			console.log('[页面] 访问登录页获取 WAF cookies...');
			await page.goto(`${this.baseUrl}/login`, {
				waitUntil: 'networkidle',
				timeout: 30000,
			});

			await this.randomDelay(2000, 3000);

			// 监听 API 响应
			let signInResponse = null;
			let userSelfResponse = null;

			page.on('response', async (response) => {
				const url = response.url();
				if (url.includes('/api/user/sign_in')) {
					console.log('[网络] 捕获签到接口响应');
					signInResponse = await response.json().catch(() => null);
				}
				if (url.includes('/api/user/self')) {
					console.log('[网络] 捕获用户信息接口响应');
					userSelfResponse = await response.json().catch(() => null);
				}
			});

			// 使用 page.evaluate 执行签到请求
			console.log('[网络] 执行签到...');
			const result = await page.evaluate(
				async ({ baseUrl, apiUser }) => {
					try {
						const response = await fetch(`${baseUrl}/api/user/sign_in`, {
							method: 'POST',
							headers: {
								Accept: 'application/json, text/plain, */*',
								'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
								'Content-Type': 'application/json',
								'new-api-user': apiUser,
								'X-Requested-With': 'XMLHttpRequest',
							},
							body: JSON.stringify({}),
							credentials: 'include',
						});

						const data = await response.json();
						return {
							status: response.status,
							data: data,
						};
					} catch (error) {
						return {
							error: error.message,
						};
					}
				},
				{ baseUrl: this.baseUrl, apiUser }
			);

			console.log(`[响应] 签到响应状态码 ${result.status}`);
			console.log(`[响应] 响应数据:`, JSON.stringify(result.data, null, 2));

			if (result.error) {
				console.log(`[失败] 签到请求失败: ${result.error}`);
				await context.close();
				return { success: false, error: result.error };
			}

			if (result.status === 200) {
				const data = result.data;
				if (data.ret === 1 || data.code === 0 || data.success) {
					console.log('[成功] 签到成功!');

					// 获取用户信息
					console.log('[信息] 获取用户信息...');
					const userInfo = await page.evaluate(
						async ({ baseUrl, apiUser }) => {
							try {
								const response = await fetch(`${baseUrl}/api/user/self`, {
									method: 'GET',
									headers: {
										Accept: 'application/json, text/plain, */*',
										'new-api-user': apiUser,
									},
									credentials: 'include',
								});

								const data = await response.json();
								if (data.success && data.data) {
									return {
										username: data.data.username,
										email: data.data.email,
										quota: data.data.quota,
										usedQuota: data.data.used_quota,
										affCode: data.data.aff_code,
									};
								}
								return null;
							} catch (error) {
								return null;
							}
						},
						{ baseUrl: this.baseUrl, apiUser }
					);

					if (userInfo) {
						console.log(`[信息] 用户名: ${userInfo.username}`);
						console.log(`[信息] 邮箱: ${userInfo.email}`);
						console.log(`[信息] 余额: $${(userInfo.quota / 500000).toFixed(2)}`);
						console.log(`[信息] 已使用: $${(userInfo.usedQuota / 500000).toFixed(2)}`);
						console.log(`[信息] 推广码: ${userInfo.affCode}`);
					}

					await context.close();
					return { success: true, userInfo };
				} else {
					const errorMsg = data.msg || data.message || '未知错误';
					console.log(`[失败] 签到失败 - ${errorMsg}`);
					console.log(`[调试] 完整响应:`, JSON.stringify(data, null, 2));
					await context.close();
					return { success: false, error: errorMsg };
				}
			} else {
				console.log(`[失败] 签到失败 - HTTP ${result.status}`);
				console.log(`[调试] 响应体:`, JSON.stringify(result.data, null, 2));
				await context.close();
				return { success: false, error: `HTTP ${result.status}` };
			}
		} catch (error) {
			console.log(`[失败] 签到过程中发生错误:`);
			console.log(`[错误] 消息: ${error.message}`);
			console.log(`[错误] 堆栈:`, error.stack);
			if (context) await context.close();
			return { success: false, error: error.message };
		}
	}
}

// 导出模块
export default AnyRouterSessionSignIn;

// 如果直接运行此文件，执行签到测试
const isMainModule = fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
	(async () => {
		const signer = new AnyRouterSessionSignIn();

		console.log('===== AnyRouter Session 签到测试 =====\n');

		// 示例：从命令行参数获取 session 和 api_user
		// 用法：node checkin-session.js <session> <api_user>
		const session = process.argv[2] || 'MTc2MTgwNjQyOHxEWDhFQVFMX2dBQUJFQUVRQUFEX3h2LUFBQVlHYzNSeWFXNW5EQW9BQ0hWelpYSnVZVzFsQm5OMGNtbHVad3dQQUExc2FXNTFlR1J2WHpnMk1ESXhCbk4wY21sdVp3d0dBQVJ5YjJ4bEEybHVkQVFDQUFJR2MzUnlhVzVuREFnQUJuTjBZWFIxY3dOcGJuUUVBZ0FDQm5OMGNtbHVad3dIQUFWbmNtOTFjQVp6ZEhKcGJtY01DUUFIWkdWbVlYVnNkQVp6ZEhKcGJtY01EUUFMYjJGMWRHaGZjM1JoZEdVR2MzUnlhVzVuREE0QUREUjBOWGxwUjFJeVJtVkZUZ1p6ZEhKcGJtY01CQUFDYVdRRGFXNTBCQVVBX1FLZ0NnPT18dbFHh5O7_lF3BE9EAKndKHehZ-1a03b7KDcqOivDUEA=';
		const apiUser = process.argv[3] || '86021';

		if (!session || !apiUser) {
			console.log('[错误] 请提供 session 和 api_user 参数');
			console.log('用法：node checkin-session.js <session> <api_user>');
			process.exit(1);
		}

		const result = await signer.signIn(session, apiUser);

		if (result && result.success) {
			console.log('\n===== 签到成功 =====');
			if (result.userInfo) {
				console.log(`用户名: ${result.userInfo.username}`);
				console.log(`余额: $${(result.userInfo.quota / 500000).toFixed(2)}`);
			}
		} else {
			console.log('\n===== 签到失败 =====');
			if (result && result.error) {
				console.log(`错误: ${result.error}`);
			}
		}
	})();
}
