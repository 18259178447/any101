/**
 * 账号管理 API
 */

import apiClient, { handleApiResponse } from './client.js';

/**
 * 添加官方账号
 * @param {Object} accountData - 账号数据
 * @param {string} accountData.username - AnyRouter账号用户名
 * @param {string} accountData.password - AnyRouter账号密码
 * @param {string} [accountData.register_email] - 注册邮箱地址（可选）
 * @returns {Promise<{success: boolean, data?: {account_id: string, username: string, register_email: string}, error?: string}>}
 */
export async function addOfficialAccount(accountData) {
	const { username, password, register_email } = accountData;

	// 验证必需字段
	if (!username || !password) {
		return {
			success: false,
			error: '用户名和密码不能为空'
		};
	}

	return handleApiResponse(
		apiClient.post('/addOfficialAccount', {
			username,
			password,
			register_email
		})
	);
}

/**
 * 更新账号信息
 * @param {string} _id - 账号记录ID
 * @param {Object} updateData - 要更新的数据
 * @param {string} [updateData.username] - 账号用户名
 * @param {string} [updateData.password] - 账号密码
 * @param {string} [updateData.register_email] - 注册邮箱
 * @param {string} [updateData.session] - 会话标识
 * @param {number} [updateData.session_expire_time] - Session过期时间戳
 * @param {string} [updateData.account_id] - AnyRouter平台账号ID
 * @param {number} [updateData.checkin_date] - 签到时间戳
 * @param {string} [updateData.github_username] - GitHub用户名
 * @param {string} [updateData.github_password] - GitHub密码
 * @param {number} [updateData.balance] - 账号余额
 * @param {boolean} [updateData.is_sold] - 是否已售出
 * @param {number} [updateData.sell_date] - 出售时间戳
 * @param {boolean} [updateData.can_sell] - 是否可出售
 * @param {string} [updateData.workflow_url] - 工作流URL
 * @param {string} [updateData.notes] - 备注信息
 * @param {string} [updateData.aff_code] - 推广码
 * @param {number} [updateData.used] - 已使用额度
 * @returns {Promise<{success: boolean, data?: {updated: number, updatedFields: string[]}, error?: string}>}
 */
export async function updateAccountInfo(_id, updateData) {
	// 验证必需字段
	if (!_id) {
		return {
			success: false,
			error: '账号ID不能为空'
		};
	}

	if (!updateData || Object.keys(updateData).length === 0) {
		return {
			success: false,
			error: '更新数据不能为空'
		};
	}

	// 移除不允许更新的字段
	const filteredData = { ...updateData };
	delete filteredData.create_date;
	delete filteredData._id;

	return handleApiResponse(
		apiClient.post('/updateAccountInfo', {
			_id,
			updateData: filteredData
		})
	);
}

export default {
	addOfficialAccount,
	updateAccountInfo
};