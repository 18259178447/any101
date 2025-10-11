/**
 * AnyRouter 统一签到模块
 * 支持多种登录方式：账号密码、LinuxDo、GitHub
 */

import AnyRouterSignIn from './checkin-username.js';
import AnyRouterLinuxDoSignIn from './checkin-linuxdo.js';
import AnyRouterGitHubSignIn from './checkin-github.js';
import { updateAccountInfo as updateAccountInfoAPI } from '../api/index.js';

class UnifiedAnyRouterChecker {
	/**
	 * @param {Array} accounts - 可选的账号数组，如果不提供则从环境变量读取
	 */
	constructor(accounts = null) {
		this.accounts = accounts || this.loadAccounts();
		this.signInModule = new AnyRouterSignIn();
		this.linuxDoSignInModule = new AnyRouterLinuxDoSignIn();
		this.githubSignInModule = new AnyRouterGitHubSignIn();
	}

	/**
	 * 从环境变量加载账号配置
	 */
	loadAccounts() {
		const accountsStr = process.env.ANYROUTER_ACCOUNTS;
		if (!accountsStr) {
			console.error('[错误] ANYROUTER_ACCOUNTS 环境变量未找到');
			return null;
		}

		try {
			const accountsData = JSON.parse(accountsStr);

			// 检查是否为数组格式
			if (!Array.isArray(accountsData)) {
				console.error('[错误] 账号配置必须使用数组格式 [{}]');
				return null;
			}

			return accountsData;
		} catch (error) {
			console.error(`[错误] 账号配置格式不正确: ${error.message}`);
			return null;
		}
	}

	/**
	 * 更新账户信息到服务端
	 * @param {string} _id - 账号ID
	 * @param {Object} updateData - 要更新的字段
	 */
	async updateAccountInfo(_id, updateData) {
		try {
			if (!_id) {
				console.log('[更新] 账号无 _id，跳过更新');
				return { success: false, message: '账号无 _id' };
			}

			// 检查是否配置了 API_BASE_URL
			if (!process.env.API_BASE_URL) {
				console.log('[更新] 未配置 API_BASE_URL，跳过服务端更新');
				return { success: false, message: '未配置 API_BASE_URL' };
			}

			console.log(`[更新] 上传账户信息到服务端: ${_id}`);

			// 调用服务端 API
			const apiResult = await updateAccountInfoAPI(_id, updateData);

			if (apiResult.success) {
				console.log(`[更新] 服务端更新成功`);
				return { success: true, message: '账户信息更新成功' };
			} else {
				console.error(`[更新] 服务端更新失败: ${apiResult.error}`);
				return { success: false, message: apiResult.error };
			}
		} catch (error) {
			console.error(`[错误] 更新账户信息失败: ${error.message}`);
			return { success: false, message: error.message };
		}
	}

	/**
	 * 使用用户名密码进行登录签到
	 */
	async checkInWithPassword(accountInfo) {
		const accountName = accountInfo.username || accountInfo._id || '未知账号';

		console.log(`[登录] ${accountName}: 使用用户名密码登录签到`);

		// 调用登录模块
		const loginResult = await this.signInModule.loginAndGetSession(
			accountInfo.username,
			accountInfo.password
		);

		if (loginResult) {
			// 只更新签到时间和余额信息
			const updateData = {
				checkin_date: Date.now()
			};
			// 构建用户信息字符串
			let userInfoText = null;

			// 如果成功获取用户信息，添加余额、已使用额度和推广码
			if (loginResult.userInfo) {
				updateData.balance = Math.round(loginResult.userInfo.quota / 500000);
				updateData.used = Math.round((loginResult.userInfo.used_quota || 0) / 500000);
				if (loginResult.userInfo.aff_code) {
					updateData.aff_code = loginResult.userInfo.aff_code;
				}

				const quota = (loginResult.userInfo.quota / 500000).toFixed(2);
				const usedQuota = (loginResult.userInfo.used_quota || 0) / 500000;
				userInfoText = `💰 当前余额: $${quota}, 已使用: $${usedQuota.toFixed(2)}`;
			}

			// 更新账户信息
			await this.updateAccountInfo(accountInfo._id, updateData);

			return {
				success: true,
				account: accountName,
				userInfo: userInfoText,
				method: 'password'
			};
		} else {
			return {
				success: false,
				account: accountName,
				error: '登录失败',
				method: 'password'
			};
		}
	}

	/**
	 * 使用 LinuxDo 第三方登录进行签到
	 */
	async checkInWithLinuxDo(accountInfo) {
		const accountName = accountInfo.username || accountInfo._id || '未知账号';

		console.log(`[登录] ${accountName}: 使用 LinuxDo 第三方登录签到`);

		// 调用 LinuxDo 登录模块
		const loginResult = await this.linuxDoSignInModule.loginAndGetSession(
			accountInfo.username,
			accountInfo.password
		);

		if (loginResult) {
			// 更新签到时间和余额信息
			const updateData = {
				checkin_date: Date.now()
			};
			// 构建用户信息字符串
			let userInfoText = null;

			// 如果成功获取用户信息，添加余额、已使用额度和推广码
			if (loginResult.userInfo) {
				updateData.balance = Math.round(loginResult.userInfo.quota / 500000);
				updateData.used = Math.round((loginResult.userInfo.used_quota || 0) / 500000);
				if (loginResult.userInfo.aff_code) {
					updateData.aff_code = loginResult.userInfo.aff_code;
				}

				const quota = (loginResult.userInfo.quota / 500000).toFixed(2);
				const usedQuota = (loginResult.userInfo.used_quota || 0) / 500000;
				userInfoText = `💰 当前余额: $${quota}, 已使用: $${usedQuota.toFixed(2)}`;
			}

			// 更新账户信息
			await this.updateAccountInfo(accountInfo._id, updateData);

			return {
				success: true,
				account: accountName,
				userInfo: userInfoText,
				method: 'linuxdo'
			};
		} else {
			return {
				success: false,
				account: accountName,
				error: 'LinuxDo 登录失败',
				method: 'linuxdo'
			};
		}
	}

	/**
	 * 使用 GitHub 第三方登录进行签到
	 */
	async checkInWithGitHub(accountInfo) {
		const accountName = accountInfo.username || accountInfo._id || '未知账号';

		console.log(`[登录] ${accountName}: 使用 GitHub 第三方登录签到`);

		// 调用 GitHub 登录模块
		const loginResult = await this.githubSignInModule.loginAndGetSession(
			accountInfo._id,
			accountInfo.username,
			accountInfo.password,
			accountInfo.notice_email
		);

		if (loginResult) {
			// 更新签到时间和余额信息
			const updateData = {
				checkin_date: Date.now()
			};
			// 构建用户信息字符串
			let userInfoText = null;

			// 如果成功获取用户信息，添加余额、已使用额度和推广码
			if (loginResult.userInfo) {
				updateData.balance = Math.round(loginResult.userInfo.quota / 500000);
				updateData.used = Math.round((loginResult.userInfo.used_quota || 0) / 500000);
				if (loginResult.userInfo.aff_code) {
					updateData.aff_code = loginResult.userInfo.aff_code;
				}

				const quota = (loginResult.userInfo.quota / 500000).toFixed(2);
				const usedQuota = (loginResult.userInfo.used_quota || 0) / 500000;
				userInfoText = `💰 当前余额: $${quota}, 已使用: $${usedQuota.toFixed(2)}`;
			}

			// 更新账户信息
			await this.updateAccountInfo(accountInfo._id, updateData);

			return {
				success: true,
				account: accountName,
				userInfo: userInfoText,
				method: 'github'
			};
		} else {
			return {
				success: false,
				account: accountName,
				error: 'GitHub 登录失败',
				method: 'github'
			};
		}
	}

	/**
	 * 为单个账号执行签到
	 */
	async checkInAccount(accountInfo, accountIndex) {
		const accountName = accountInfo.username || accountInfo._id || `账号 ${accountIndex + 1}`;
		console.log(`\n[处理中] 开始处理 ${accountName}`);

		const hasPassword = accountInfo.username && accountInfo.password;

		if (!hasPassword) {
			console.log(`[失败] ${accountName}: 缺少用户名或密码`);
			return {
				success: false,
				account: accountName,
				error: '缺少用户名或密码'
			};
		}

		// 获取登录类型（默认为账号密码登录）
		const accountType = accountInfo.account_type ?? 0;

		// 根据登录类型选择对应的登录方法
		switch (accountType) {
			case 0:
				// 账号密码登录
				console.log(`[类型] ${accountName}: 账号密码登录`);
				return await this.checkInWithPassword(accountInfo);

			case 1:
				// LinuxDo 第三方登录
				console.log(`[类型] ${accountName}: LinuxDo 第三方登录`);
				return await this.checkInWithLinuxDo(accountInfo);

			case 2:
				// GitHub 第三方登录
				console.log(`[类型] ${accountName}: GitHub 第三方登录`);
				return await this.checkInWithGitHub(accountInfo);

			default:
				console.log(`[失败] ${accountName}: 未知的登录类型 ${accountType}`);
				return {
					success: false,
					account: accountName,
					error: `未知的登录类型: ${accountType}`
				};
		}
	}

	/**
	 * 按邮箱分组通知结果
	 */
	groupResultsByEmail(results, accounts) {
		const emailGroups = {};

		results.forEach((result, index) => {
			const account = accounts[index];
			const email = account.notice_email || process.env.EMAIL_TO || 'default';

			if (!emailGroups[email]) {
				emailGroups[email] = {
					email: email,
					results: [],
					successCount: 0,
					totalCount: 0
				};
			}

			emailGroups[email].results.push(result);
			emailGroups[email].totalCount++;
			if (result.success) {
				emailGroups[email].successCount++;
			}
		});

		return emailGroups;
	}

	/**
	 * 执行所有账号签到
	 */
	async run() {
		console.log('[系统] AnyRouter.top 多账号自动签到脚本启动 (统一版)');
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

				// 账号之间添加延迟，避免频繁操作触发限制
				if (i < this.accounts.length - 1) {
					const delay = 5000 + Math.random() * 2000; // 5-7秒随机延迟
					console.log(`[等待] 等待 ${(delay / 1000).toFixed(1)} 秒后处理下一个账号...`);
					await new Promise(resolve => setTimeout(resolve, delay));
				}
			} catch (error) {
				console.log(`[失败] 账号 ${i + 1} 处理异常: ${error.message}`);
				results.push({
					success: false,
					account: this.accounts[i].username || `账号 ${i + 1}`,
					error: error.message
				});
			}
		}

		// 按邮箱分组
		const emailGroups = this.groupResultsByEmail(results, this.accounts);

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
			emailGroups: emailGroups,
			successCount: successCount,
			totalCount: totalCount
		};
	}
}

export default UnifiedAnyRouterChecker;