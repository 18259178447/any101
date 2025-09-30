/**
 * AnyRouter 签到核心模块
 */

import { chromium } from 'playwright';
import axios from 'axios';
import { createHTTP2Adapter } from 'axios-http2-adapter';

class AnyRouterChecker {
	constructor() {
		this.accounts = this.loadAccounts();
	}

	/**
	 * 从环境变量加载账号配置
	 */
	loadAccounts() {
var a = {
	"_id": "68db64aa095d887bc048af78",
  "used": 0,
  "notes": "",
  "balance": 125,
  "is_sold": false,
  "session": "==",
  "aff_code": "jlYs",
  "can_sell": true,
  "password": "x59208415078",
  "username": "59208415078",
  "sell_date": 0,
  "api_user": "83810",
  "create_date": 1759208618146,
  "update_date": 1759225338342,
  "checkin_date": 1759225322748,
  "workflow_url": "",
  "register_email": "1759208415078@stu.huel.edu.cn",
  "github_password": "",
  "github_username": "",
  "anyrouter_user_id": "official_user_001",
  "session_expire_time": 1761817322748
}
		return [{
			"api_user": "83810",
			cookies:{
				session:"MTc1OTIyNTMyMHxEWDhFQVFMX2dBQUJFQUVRQUFEX2xfLUFBQVVHYzNSeWFXNW5EQW9BQ0hWelpYSnVZVzFsQm5OMGNtbHVad3dOQUFzMU9USXdPRFF4TlRBM09BWnpkSEpwYm1jTUJnQUVjbTlzWlFOcGJuUUVBZ0FDQm5OMGNtbHVad3dJQUFaemRHRjBkWE1EYVc1MEJBSUFBZ1p6ZEhKcGJtY01Cd0FGWjNKdmRYQUdjM1J5YVc1bkRBa0FCMlJsWm1GMWJIUUdjM1J5YVc1bkRBUUFBbWxrQTJsdWRBUUZBUDBDanNRPXwIQ_eRn21eC7_jXlkl3DpWOj7r2E0P7uN6M3m1JxQxOg=="
			}
		}]

		const accountsStr = process.env.ANYROUTER_ACCOUNTS;
		if (!accountsStr) {
			console.error('ERROR: ANYROUTER_ACCOUNTS 环境变量未找到');
			return null;
		}

		try {
			const accountsData = JSON.parse(accountsStr);

			// 检查是否为数组格式
			if (!Array.isArray(accountsData)) {
				console.error('ERROR: 账号配置必须使用数组格式 [{}]');
				return null;
			}

			// 验证账号数据格式
			for (let i = 0; i < accountsData.length; i++) {
				const account = accountsData[i];
				if (typeof account !== 'object' || !account.cookies || !account.api_user) {
					console.error(`ERROR: 账号 ${i + 1} 缺少必需字段 (cookies, api_user)`);
					return null;
				}
			}

			return accountsData;
		} catch (error) {
			console.error(`ERROR: 账号配置格式不正确: ${error.message}`);
			return null;
		}
	}

	/**
	 * 解析 cookies 数据
	 */
	parseCookies(cookiesData) {
		if (typeof cookiesData === 'object' && !Array.isArray(cookiesData)) {
			return cookiesData;
		}

		if (typeof cookiesData === 'string') {
			const cookiesDict = {};
			const cookies = cookiesData.split(';');
			for (const cookie of cookies) {
				if (cookie.includes('=')) {
					const [key, value] = cookie.trim().split('=', 2);
					cookiesDict[key] = value;
				}
			}
			return cookiesDict;
		}

		return {};
	}

	/**
	 * 使用 Playwright 获取 WAF cookies
	 */
	async getWafCookies(accountName) {
		console.log(`[处理中] ${accountName}: 启动浏览器获取 WAF cookies...`);

		// 使用 launchPersistentContext 以保持与 Python 版本一致
		const context = await chromium.launchPersistentContext('', {
			headless: false,
			userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
			viewport: { width: 1920, height: 1080 },
			args: [
				'--disable-blink-features=AutomationControlled',
				'--disable-dev-shm-usage',
				'--disable-web-security',
				'--disable-features=VizDisplayCompositor',
				'--no-sandbox'
			]
		});

		const page = await context.newPage();

		try {
			console.log(`[处理中] ${accountName}: 步骤 1: 访问登录页获取初始 cookies...`);

			await page.goto('https://anyrouter.top/login', {
				waitUntil: 'networkidle'
			});

			// 等待页面完全加载
			try {
				await page.waitForFunction('document.readyState === "complete"', { timeout: 5000 });
			} catch {
				await page.waitForTimeout(3000);
			}

			// 获取 cookies
			const cookies = await context.cookies();
			const wafCookies = {};

			for (const cookie of cookies) {
				if (['acw_tc', 'cdn_sec_tc', 'acw_sc__v2'].includes(cookie.name)) {
					wafCookies[cookie.name] = cookie.value;
				}
			}

			console.log(`[信息] ${accountName}: 获取到 ${Object.keys(wafCookies).length} 个 WAF cookies`);

			// 检查必需的 cookies
			const requiredCookies = ['acw_tc', 'cdn_sec_tc', 'acw_sc__v2'];
			const missingCookies = requiredCookies.filter(c => !wafCookies[c]);

			if (missingCookies.length > 0) {
				console.log(`[失败] ${accountName}: 缺少 WAF cookies: ${missingCookies.join(', ')}`);
				await context.close();
				return null;
			}

			console.log(`[成功] ${accountName}: 成功获取所有 WAF cookies`);
			await context.close();

			return wafCookies;

		} catch (error) {
			console.log(`[失败] ${accountName}: 获取 WAF cookies 时发生错误: ${error.message}`);
			await context.close();
			return null;
		}
	}

	/**
	 * 获取用户信息
	 */
	async getUserInfo(cookies, apiUser) {
		try {
			const cookieString = Object.entries(cookies)
				.map(([key, value]) => `${key}=${value}`)
				.join('; ');

			// 使用 HTTP/2
			const axiosInstance = axios.create({
				adapter: createHTTP2Adapter({
					force: true
				})
			});

			const response = await axiosInstance.get('https://anyrouter.top/api/user/self', {
				headers: {
					'Cookie': cookieString,
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
					'Accept': 'application/json, text/plain, */*',
					'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
					'Accept-Encoding': 'gzip, deflate, br, zstd',
					'Referer': 'https://anyrouter.top/console',
					'Origin': 'https://anyrouter.top',
					'Connection': 'keep-alive',
					'Sec-Fetch-Dest': 'empty',
					'Sec-Fetch-Mode': 'cors',
					'Sec-Fetch-Site': 'same-origin',
					'new-api-user': apiUser
				},
				timeout: 30000
			});

			if (response.status === 200 && response.data.success) {
				const userData = response.data.data || {};
				const quota = (userData.quota / 500000).toFixed(2);
				const usedQuota = (userData.used_quota / 500000).toFixed(2);
				return `:money: 当前余额: $${quota}, 已使用: $${usedQuota}`;
			}
		} catch (error) {
			return `[失败] 获取用户信息失败: ${error.message.substring(0, 50)}...`;
		}
		return null;
	}

	/**
	 * 为单个账号执行签到
	 */
	async checkInAccount(accountInfo, accountIndex) {
		const accountName = `账号 ${accountIndex + 1}`;
		console.log(`\n[处理中] 开始处理 ${accountName}`);

		// 解析账号配置
		const cookiesData = accountInfo.cookies || {};
		const apiUser = accountInfo.api_user || '';

		if (!apiUser) {
			console.log(`[失败] ${accountName}: API user 标识未找到`);
			return { success: false, account: accountName };
		}

		// 解析用户 cookies
		const userCookies = this.parseCookies(cookiesData);
		if (!userCookies || Object.keys(userCookies).length === 0) {
			console.log(`[失败] ${accountName}: 无效的配置格式`);
			return { success: false, account: accountName };
		}

		// 步骤1：获取 WAF cookies
		const wafCookies = await this.getWafCookies(accountName);
		if (!wafCookies) {
			console.log(`[失败] ${accountName}: 无法获取 WAF cookies`);
			return { success: false, account: accountName };
		}

		// 步骤2：使用 axios 进行 API 请求
		try {
			// 合并 WAF cookies 和用户 cookies
			const allCookies = { ...wafCookies, ...userCookies };

			console.log(`[网络] ${accountName}: 执行签到`);

			// 构建 cookie 字符串
			const cookieString = Object.entries(allCookies)
				.map(([key, value]) => `${key}=${value}`)
				.join('; ');

			// 发送签到请求（使用 HTTP/2）
			const axiosInstance = axios.create({
				adapter: createHTTP2Adapter({
					force: true
				})
			});

			const response = await axiosInstance.post(
				'https://anyrouter.top/api/user/sign_in',
				{},
				{
					headers: {
						'Cookie': cookieString,
						'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
						'Accept': 'application/json, text/plain, */*',
						'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
						'Accept-Encoding': 'gzip, deflate, br, zstd',
						'Referer': 'https://anyrouter.top/console',
						'Origin': 'https://anyrouter.top',
						'Connection': 'keep-alive',
						'Sec-Fetch-Dest': 'empty',
						'Sec-Fetch-Mode': 'cors',
						'Sec-Fetch-Site': 'same-origin',
						'new-api-user': apiUser,
						'Content-Type': 'application/json',
						'X-Requested-With': 'XMLHttpRequest'
					},
					timeout: 30000,
					validateStatus: () => true // 接受所有状态码
				}
			);

			console.log(`[响应] ${accountName}: 响应状态码 ${response.status}`);

			let userInfoText = null;

			if (response.status === 200) {
				const result = response.data;
				if (result.ret === 1 || result.code === 0 || result.success) {
					console.log(`[成功] ${accountName}: 签到成功!`);

					// 签到成功后获取用户信息
					const userInfo = await this.getUserInfo(allCookies, apiUser);
					if (userInfo) {
						console.log(userInfo);
						userInfoText = userInfo;
					}

					return { success: true, account: accountName, userInfo: userInfoText };
				} else {
					const errorMsg = result.msg || result.message || '未知错误';
					console.log(`[失败] ${accountName}: 签到失败 - ${errorMsg}`);
					return { success: false, account: accountName, userInfo: userInfoText };
				}
			} else {
				console.log(`[失败] ${accountName}: 签到失败 - HTTP ${response.status}`);
				return { success: false, account: accountName, userInfo: userInfoText };
			}

		} catch (error) {
			console.log(`[失败] ${accountName}: 签到过程中发生错误 - ${error.message.substring(0, 50)}...`);
			return { success: false, account: accountName, error: error.message };
		}
	}

	/**
	 * 执行所有账号签到
	 */
	async run() {
		console.log('[系统] AnyRouter.top 多账号自动签到脚本启动 (使用 Playwright)');
		console.log(`[时间] 执行时间: ${new Date().toLocaleString('zh-CN')}`);

		if (!this.accounts) {
			console.log('[失败] 无法加载账号配置，程序退出');
			return { success: false, results: [] };
		}

		console.log(`[信息] 找到 ${this.accounts.length} 个账号配置`);

		const results = [];

		// 为每个账号执行签到
		for (let i = 0; i < this.accounts.length; i++) {
			try {
				const result = await this.checkInAccount(this.accounts[i], i);
				results.push(result);
			} catch (error) {
				console.log(`[失败] 账号 ${i + 1} 处理异常: ${error.message}`);
				results.push({
					success: false,
					account: `账号 ${i + 1}`,
					error: error.message
				});
			}
		}

		// 统计结果
		const successCount = results.filter(r => r.success).length;
		const totalCount = this.accounts.length;

		console.log('\n[统计] 签到结果统计:');
		console.log(`[成功] 成功: ${successCount}/${totalCount}`);
		console.log(`[失败] 失败: ${totalCount - successCount}/${totalCount}`);

		if (successCount === totalCount) {
			console.log('[成功] 所有账号签到成功!');
		} else if (successCount > 0) {
			console.log('[警告] 部分账号签到成功');
		} else {
			console.log('[错误] 所有账号签到失败');
		}

		return {
			success: successCount > 0,
			results: results,
			successCount: successCount,
			totalCount: totalCount
		};
	}
}

export default AnyRouterChecker;

new AnyRouterChecker().run()