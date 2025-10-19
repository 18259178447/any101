/**
 * 注册申请管理 API
 */

import apiClient, { handleApiResponse } from './client.js';

/**
 * 随机获取未使用的注册申请数据
 * @description 从数据库中随机选择一个未使用的LinuxDo注册申请数据(包含姓名拼音和申请自述),并自动标记为已使用
 * @returns {Promise<{success: boolean, data?: {id: string, name_pinyin: string, application: string}, error?: string}>}
 * @example
 * const result = await getRandomApplication();
 * if (result.success) {
 *   console.log('申请ID:', result.data.id);
 *   console.log('姓名拼音:', result.data.name_pinyin);
 *   console.log('申请自述:', result.data.application);
 * }
 */
export async function getRandomApplication() {
	return handleApiResponse(apiClient.post('/getRandomApplication', {}));
}

export default {
	getRandomApplication,
};
