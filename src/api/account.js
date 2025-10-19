/**
 * 账号管理 API
 */

import apiClient, { handleApiResponse } from './client.js';

/**
 * 添加官方账号
 * @description 添加一个新的官方账号，可以用于出售。支持三种登录类型：账号密码登录、LinuxDo登录、GitHub登录
 * @param {Object} accountData - 账号数据
 * @param {string} accountData.username - 账号名称，根据account_type不同含义不同：0-AnyRouter账号名，1-LinuxDo账号名，2-GitHub账号名
 * @param {string} accountData.password - 账号密码，根据account_type不同含义不同：0-AnyRouter密码，1-LinuxDo密码，2-GitHub密码
 * @param {number} [accountData.account_type=0] - 账号类型（可选，默认0）：0-账号密码登录，1-LinuxDo登录，2-GitHub登录
 * @returns {Promise<{success: boolean, data?: {account_id: string, username: string, account_type: number}, error?: string}>}
 */
export async function addOfficialAccount(accountData) {
	const { username, password, account_type = 0 } = accountData;

	// 验证必需字段
	if (!username || !password) {
		return {
			success: false,
			error: '用户名和密码不能为空',
		};
	}

	// 验证账号类型
	if (![0, 1, 2].includes(account_type)) {
		return {
			success: false,
			error: '账号类型必须为0（账号密码）、1（LinuxDo）或2（GitHub）',
		};
	}

	return handleApiResponse(
		apiClient.post('/addOfficialAccount', {
			username,
			password,
			account_type,
		})
	);
}

/**
 * 更新账号信息
 * @description 更新指定账号的信息，支持部分字段更新
 * @param {string} _id - 账号记录ID
 * @param {Object} updateData - 要更新的数据
 * @param {string} [updateData.username] - 账号名称，根据account_type不同含义不同
 * @param {string} [updateData.password] - 账号密码，根据account_type不同含义不同
 * @param {string} [updateData.session] - 会话标识
 * @param {number} [updateData.session_expire_time] - Session过期时间戳
 * @param {string} [updateData.account_id] - AnyRouter平台账号ID
 * @param {number} [updateData.checkin_date] - 签到时间戳
 * @param {number} [updateData.balance] - AnyRouter账号余额
 * @param {number} [updateData.agentrouter_balance] - AgentRouter账号余额
 * @param {boolean} [updateData.is_sold] - 是否已售出
 * @param {number} [updateData.sell_date] - 出售时间戳
 * @param {boolean} [updateData.can_sell] - 是否可出售
 * @param {string} [updateData.workflow_url] - 工作流URL
 * @param {string} [updateData.notes] - 备注信息
 * @param {string} [updateData.cache_key] - 用户持久化时的辅助key
 * @param {number} [updateData.checkin_error_count] - 连续签到失败的次数统计
 * @param {number} [updateData.checkin_mode] - 签到模式：1-只签到anyrouter，2-只签到agentrouter，3-两者都签到
 * @param {string} [updateData.aff_code] - 推广码（本地定义字段，API不支持）
 * @param {number} [updateData.used] - 已使用额度（本地定义字段，API不支持）
 * @returns {Promise<{success: boolean, data?: {updated: number, updatedFields: string[]}, error?: string}>}
 */
export async function updateAccountInfo(_id, updateData) {
	// 验证必需字段
	if (!_id) {
		return {
			success: false,
			error: '账号ID不能为空',
		};
	}

	if (!updateData || Object.keys(updateData).length === 0) {
		return {
			success: false,
			error: '更新数据不能为空',
		};
	}

	// 移除不允许更新的字段
	const filteredData = { ...updateData };
	delete filteredData.create_date;
	delete filteredData._id;
	delete filteredData.account_type; // 不允许更新账号类型

	return handleApiResponse(
		apiClient.post('/updateAccountInfo', {
			_id,
			updateData: filteredData,
		})
	);
}

/**
 * 获取账号登录信息
 * @param {Object} params - 查询参数
 * @param {string} params.login_info_id - 登录信息记录ID
 * @param {string} params.account_id - 账号记录ID（关联anyrouter-accounts表的_id）
 * @returns {Promise<{success: boolean, data?: {_id: string, account_id: string, github_device_code: string, linuxdo_login_url: string, create_date: number}|null, error?: string}>}
 */
export async function getAccountLoginInfo(params) {
	const { login_info_id, account_id } = params;

	// 验证必需字段
	if (!login_info_id || !account_id) {
		return {
			success: false,
			error: '登录信息ID和账号ID不能为空',
		};
	}

	return handleApiResponse(
		apiClient.post('/getAccountLoginInfo', {
			login_info_id,
			account_id,
		})
	);
}

/**
 * 添加账号登录信息
 * @param {Object} params - 请求参数
 * @param {string} params.account_id - 账号记录ID（关联anyrouter-accounts表的_id）
 * @returns {Promise<{success: boolean, data?: {login_info_id: string, expire_time: number}, error?: string}>}
 */
export async function addAccountLoginInfo(params) {
	const { account_id } = params;

	// 验证必需字段
	if (!account_id) {
		return {
			success: false,
			error: '账号ID不能为空',
		};
	}

	return handleApiResponse(
		apiClient.post('/addAccountLoginInfo', {
			account_id,
		})
	);
}

export default {
	addOfficialAccount,
	updateAccountInfo,
	getAccountLoginInfo,
	addAccountLoginInfo,
};
