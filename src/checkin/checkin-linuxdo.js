/**
 * AnyRouter LinuxDo 登录签到模块
 * 通过 LinuxDo 第三方登录方式获取 session 和 api_user
 */

import { chromium } from 'playwright';
import { PlaywrightAntiFingerprintPlugin } from '../utils/playwright-anti-fingerprint-plugin.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
class AnyRouterLinuxDoSignIn {
	constructor(baseUrl = 'https://anyrouter.top') {
		this.baseUrl = baseUrl;
		this.linuxDoUrl = 'https://linux.do';
	}

	/**
	 * 获取用户的持久化存储目录
	 * @param {string} username - LinuxDo 用户名
	 * @param {string} cacheKey - 缓存键（可选）
	 * @returns {string} - 用户数据目录路径
	 */
	getUserDataDir(username, cacheKey = '') {
		const storageDir = path.join(process.cwd(), '.playwright-state');
		const userDir = path.join(storageDir, `linuxdo_${username}${cacheKey}`);

		// 确保目录存在
		if (!fs.existsSync(storageDir)) {
			fs.mkdirSync(storageDir, { recursive: true });
		}

		return userDir;
	}

	/**
	 * 删除用户的持久化缓存
	 * @param {string} username - LinuxDo 用户名
	 * @param {string} cacheKey - 缓存键（可选）
	 * @returns {boolean} - 删除是否成功
	 */
	clearUserCache(username, cacheKey = '') {
		try {
			const userDir = this.getUserDataDir(username, cacheKey);

			if (fs.existsSync(userDir)) {
				fs.rmSync(userDir, { recursive: true, force: true });
				console.log(`[清理] 已删除持久化缓存: ${userDir}`);
				return true;
			} else {
				console.log(`[清理] 持久化缓存不存在: ${userDir}`);
				return false;
			}
		} catch (error) {
			console.error(`[错误] 删除持久化缓存失败: ${error.message}`);
			return false;
		}
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
	 * 通过 LinuxDo 第三方登录获取 session 和 api_user
	 * @param {string} username - LinuxDo 用户名
	 * @param {string} password - LinuxDo 密码
	 * @param {string} cacheKey - 缓存键（可选）
	 * @returns {Object|null} - { session: string, apiUser: string, userInfo: object }
	 */
	async loginAndGetSession(username, password, cacheKey = '') {
		console.log(`[登录签到] 开始处理 LinuxDo 账号: ${username} -> ${this.baseUrl}`);

		let context = null;
		let page = null;

		try {
			// 获取用户专属数据目录
			const userDataDir = this.getUserDataDir(username, cacheKey);
			console.log(`[浏览器] 使用持久化上下文: ${userDataDir}`);
			console.log('[浏览器] 启动 Chromium 浏览器（持久化模式，已启用反检测和反指纹）...');

			// 创建反指纹插件实例（启用跨标签页一致性）
			// 不传入 sessionSeed，让插件生成随机种子，首次运行后会持久化到 localStorage
			const antiFingerprintPlugin = new PlaywrightAntiFingerprintPlugin({
				debug: false,
				crossTabConsistency: true, // 启用跨会话一致性，种子会被持久化
				// sessionSeed 不设置，使用 Math.random() 生成随机种子
				heartbeatInterval: 2000,
				sessionTimeout: 5000
			});
			context = await chromium.launchPersistentContext(userDataDir, PlaywrightAntiFingerprintPlugin.getLaunchOptions({
				headless: false, // 非无头模式，需要用户手动过人机验证
			}));

			// 应用反指纹插件到浏览器上下文
			await antiFingerprintPlugin.apply(context);
			console.log('[指纹] 反指纹保护已应用');

			// 获取或创建页面
			const pages = context.pages();
			page = pages.length > 0 ? pages[0] : await context.newPage();

			// 设置请求拦截，监听登录和签到接口
			let signInResponse = null;
			let userSelfResponse = null;
			let sessionCookie = null;

			// 创建 Promise 用于等待 /api/user/self 响应
			let userSelfResolve;
			const userSelfPromise = new Promise((resolve) => {
				userSelfResolve = resolve;
			});

			page.on('response', async (response) => {
				const url = response.url();

				// 注释掉签到接口监听 - AnyRouter 和 AgentRouter 都不需要监听此接口
				// if (url.includes('/api/user/sign_in')) {
				// 	console.log('[网络] 捕获签到接口响应');
				// 	signInResponse = await response.json().catch(() => null);
				// }

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
				timeout: 30000,
			});

			// 等待页面加载完成
			await this.randomDelay(1000, 2000);

			// 检查当前页面 URL,判断是否已登录
			const currentPageUrl = page.url();
			console.log(`[检查] 当前页面: ${currentPageUrl}`);

			// 如果已经在 /console 页面,说明已登录,直接跳到获取用户信息步骤
			if (currentPageUrl.includes('/console')) {
				console.log('[检测] 已登录,跳过 LinuxDo 登录流程');

				// 如果在 /console/token 等子页面,跳转到 /console
				if (!currentPageUrl.endsWith('/console')) {
					console.log('[导航] 跳转到 /console 页面...');
					await page.goto(`${this.baseUrl}/console`, {
						waitUntil: 'networkidle',
						timeout: 15000,
					});
					await this.randomDelay(2000, 3000);
				}

				// 直接跳到步骤7: 获取用户信息
				console.log('[等待] 等待用户信息接口响应...');
				const userSelfReceived = await Promise.race([
					userSelfPromise,
					new Promise((resolve) => setTimeout(() => resolve(false), 10000)),
				]);

				if (!userSelfReceived) {
					console.log('[警告] 等待 /api/user/self 接口超时，将使用备用方案');
				}

				// 跳转到获取用户信息的代码段
				// 使用标签跳转(通过设置变量控制流程)
			} else if (currentPageUrl.includes('/login') || currentPageUrl.includes('/register?aff=')) {
				// 未登录,在登录页面,继续 LinuxDo 登录流程
				console.log('[检测] 未登录,开始 LinuxDo 登录流程');
			} else {
				console.log(`[警告] 未预期的页面: ${currentPageUrl}`);
			}

			// 只有在登录页面才执行以下步骤
			if (currentPageUrl.includes('/login') || currentPageUrl.includes('/register?aff=')) {
				// 步骤2: 检查并关闭系统公告弹窗
				console.log('[检查] 检测系统公告弹窗...');
				try {
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

				// 步骤3: 点击 "使用 LinuxDO 继续" 按钮，等待新标签页打开
				console.log('[登录] 检查 "使用 LinuxDO 继续" 按钮...');

				// 先检查按钮是否存在
				const linuxDoButton = page.getByRole('button', { name: '使用 LinuxDO 继续' });
				const isButtonVisible = await linuxDoButton.isVisible().catch(() => false);

				if (!isButtonVisible) {
					console.log('[按钮] "使用 LinuxDO 继续" 按钮不可见，刷新页面后重试...');
					await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
					await this.randomDelay(1000, 2000);

					// 刷新后再次检查弹窗
					console.log('[检查] 刷新后检测系统公告弹窗...');
					try {
						const dialogSelector = 'div[role="dialog"]';
						await page.waitForSelector(dialogSelector, { timeout: 3000 });

						console.log('[弹窗] 发现系统公告，准备关闭...');
						await this.randomDelay(500, 1000);

						const closeButton = page.getByRole('button', { name: '关闭公告' });
						if (await closeButton.isVisible()) {
							await closeButton.click();
							console.log('[弹窗] 已关闭系统公告');
							await this.randomDelay(500, 1000);
						}
					} catch (e) {
						console.log('[弹窗] 未发现系统公告弹窗');
					}
				}

				console.log('[登录] 点击 "使用 LinuxDO 继续" 按钮...');

				// 监听新标签页事件
				const newPagePromise = context.waitForEvent('page');
				await linuxDoButton.click();

				// 等待新标签页打开
				console.log('[等待] 等待 LinuxDo 授权页面在新标签页打开...');
				const newPage = await newPagePromise;
				await newPage.waitForLoadState('domcontentloaded');

				// 切换到新标签页
				page = newPage;
				console.log(`[页面] 已切换到新标签页: ${page.url()}`);

				// 在新页面上设置响应监听
				page.on('response', async (response) => {
					const url = response.url();
					console.log(`[网络] 捕获响应: ${url}`);
					// 监听签到接口响应
					if (url === `${this.baseUrl}/api/user/sign_in`) {
						console.log('[网络] 捕获签到接口响应');
						signInResponse = await response.json().catch(() => null);
					}

					// 监听用户信息接口响应
					if (url === `${this.baseUrl}/api/user/self`) {
						console.log('[网络] 捕获用户信息接口响应');
						userSelfResponse = await response.json().catch(() => null);
						userSelfResolve(true); // 通知已收到响应
					}
				});

				// 等待页面完全加载
				await this.randomDelay(1000, 2000);

				// 步骤4: 检查是否跳转到 LinuxDo 登录页面
				const currentUrl = page.url();
				console.log(`[页面] 当前 URL: ${currentUrl}`);

				if (currentUrl.includes('linux.do/login')) {
					// 需要登录 LinuxDo
					console.log('[LinuxDo] 检测到需要登录，开始填写 LinuxDo 账号...');

					// 等待登录表单加载
					await page.waitForSelector('#login-account-name', { timeout: 20000 });
					await this.randomDelay(500, 1000);

					// 输入用户名
					console.log('[输入] 填写 LinuxDo 用户名...');
					const usernameInput = page.locator('#login-account-name');
					await usernameInput.click();
					await this.randomDelay(300, 600);

					// 模拟逐字输入
					for (const char of username) {
						await page.keyboard.type(char);
						await this.randomDelay(50, 150);
					}

					// 输入密码
					console.log('[输入] 填写 LinuxDo 密码...');
					const passwordInput = page.locator('#login-account-password');
					await passwordInput.click();
					await this.randomDelay(300, 600);

					// 模拟逐字输入密码
					for (const char of password) {
						await page.keyboard.type(char);
						await this.randomDelay(50, 150);
					}

					await this.randomDelay(500, 1000);

					// 点击登录按钮
					console.log('[LinuxDo] 点击登录按钮...');
					const loginButton = page.locator('#login-button');
					await loginButton.click();

					// 等待跳转到授权页面
					console.log('[等待] 等待跳转到授权页面...');
					await page.waitForURL('**/oauth2/authorize**', {
						timeout: 150000,
					});
					await this.randomDelay(1000, 2000);
				} else if (currentUrl.includes('oauth2/authorize')) {
					// 已经登录，直接到达授权页面
					console.log('[LinuxDo] 已登录，进入授权页面');
				} else {
					console.log('[警告] 未按预期跳转，当前URL: ' + currentUrl);
				}

				// 步骤5: 点击授权页面的"允许"按钮
				console.log('[授权] 等待授权页面加载...');
				await page.waitForSelector('a[href*="/oauth2/approve/"]', { timeout: 100000 });
				await this.randomDelay(500, 1000);

				console.log('[授权] 点击"允许"按钮...');
				const allowButton = page.getByRole('link', { name: '允许' });
				await allowButton.click();

				// 步骤6: 等待跳转回 AnyRouter 并完成登录
				console.log('[等待] 等待跳转回 AnyRouter...');

				// 等待页面稳定
				await this.randomDelay(3000, 5000);

				// 检查当前页面
				const finalUrl = page.url();
				console.log(`[成功] 登录成功，当前页面: ${finalUrl}`);

				// 如果在 /console/token 页面，需要跳转到 /console 触发用户信息接口
				if (finalUrl.includes('/console/token')) {
					console.log('[导航] 检测到在 /console/token 页面，跳转到 /console 触发接口...');
					await page.goto(`${this.baseUrl}/console`, {
						waitUntil: 'networkidle',
						timeout: 15000,
					});
					console.log('[成功] 已跳转到控制台页面');
					await this.randomDelay(2000, 3000);
				}

				// 等待 /api/user/self 接口响应（最多等待 10 秒）
				console.log('[等待] 等待用户信息接口响应...');
				const userSelfReceived2 = await Promise.race([
					userSelfPromise,
					new Promise((resolve) => setTimeout(() => resolve(false), 10000)),
				]);

				if (!userSelfReceived2) {
					console.log('[警告] 等待 /api/user/self 接口超时，将使用备用方案');
				}
			} // 结束 if (currentPageUrl.includes('/login')) 代码块

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
						console.log('[警告] localStorage 数据可能不准确，建议使用 /api/user/self 接口数据');
					} catch (e) {
						console.log('[错误] 解析用户数据失败');
					}
				}
			}

			// 获取当前页面的所有 cookies
			const cookies = await context.cookies();
			const sessionCookieFromPage = cookies.find((c) => c.name === 'session');

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
					userInfo: userData,
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
			// 确保清理资源（会自动保存状态）
			try {
				// 如果是 AgentRouter，清除该域名的缓存（下次签到需要重新登录才有效）
				if (this.baseUrl.includes('agentrouter.org')) {
					console.log('[清理] 检测到 AgentRouter 签到，清除该域名缓存...');

					// 清除 AgentRouter 域名的 cookies
					if (context) {
						const allCookies = await context.cookies();
						const agentRouterCookies = allCookies.filter(cookie =>
							cookie.domain.includes('agentrouter.org')
						);

						if (agentRouterCookies.length > 0) {
							await context.clearCookies();
							// 重新添加非 AgentRouter 的 cookies
							const otherCookies = allCookies.filter(cookie =>
								!cookie.domain.includes('agentrouter.org')
							);
							if (otherCookies.length > 0) {
								await context.addCookies(otherCookies);
							}
							console.log(`[清理] 已清除 ${agentRouterCookies.length} 个 AgentRouter cookies`);
						}
					}

					// 清除 AgentRouter 域名的 localStorage（当前页面已在 agentrouter.org 域名下）
					if (page && !page.isClosed()) {
						await page.evaluate(() => {
							localStorage.clear();
							sessionStorage.clear();
						}).catch(() => { });
						console.log('[清理] 已清除 AgentRouter localStorage 和 sessionStorage');
					}
				}

				if (page && !page.isClosed()) await page.close();
				if (context) await context.close(); // 自动保存所有 cookies 和 localStorage
				console.log('[存储] 浏览器状态已自动保存');
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

			const result = await this.loginAndGetSession(account.username, account.password);

			results.push({
				username: account.username,
				success: result !== null,
				data: result,
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
export default AnyRouterLinuxDoSignIn;


// 如果直接运行此文件，执行注册
const isMainModule = fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
	(async () => {
		const signin = new AnyRouterLinuxDoSignIn();

		// 示例：单个账号登录
		console.log('===== AnyRouter LinuxDo 登录签到测试 =====\n');

		// 从环境变量或命令行参数获取账号信息
		const username = process.env.LINUXDO_USERNAME || 'yujie1';
		const password = process.env.LINUXDO_PASSWORD || 'yujie1i4z6';

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

