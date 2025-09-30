/**
 * API 客户端基础配置
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * 创建 axios 实例
 */
const apiClient = axios.create({
	baseURL: process.env.API_BASE_URL || 'http://localhost:3000',
	timeout: 30000,
	headers: {
		'Content-Type': 'application/json'
	}
});

/**
 * 请求拦截器
 */
apiClient.interceptors.request.use(
	(config) => {
		console.log(`[API请求] ${config.method.toUpperCase()} ${config.url}`);
		return config;
	},
	(error) => {
		console.error('[API请求错误]', error);
		return Promise.reject(error);
	}
);

/**
 * 响应拦截器
 */
apiClient.interceptors.response.use(
	(response) => {
		console.log(`[API响应] ${response.config.url} - 状态: ${response.status}`);
		return response;
	},
	(error) => {
		if (error.response) {
			console.error(`[API错误] ${error.response.status} - ${error.response.data?.errMsg || error.message}`);
		} else if (error.request) {
			console.error('[API错误] 没有收到响应', error.message);
		} else {
			console.error('[API错误]', error.message);
		}
		return Promise.reject(error);
	}
);

/**
 * 通用 API 响应处理
 * @param {Promise} apiPromise - API 请求 Promise
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
export async function handleApiResponse(apiPromise) {
	try {
		const response = await apiPromise;
		const data = response.data;

		// 判断响应是否成功
		if (data.errCode === 0) {
			return {
				success: true,
				data: data.data
			};
		} else {
			return {
				success: false,
				error: data.errMsg || '未知错误'
			};
		}
	} catch (error) {
		return {
			success: false,
			error: error.response?.data?.errMsg || error.message
		};
	}
}

export default apiClient;