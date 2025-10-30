/**
 * 2FA验证码工具
 * 支持TOTP（基于时间的一次性密码）验证码生成和验证
 * @module utils/twofa
 */

import speakeasy from 'speakeasy';

/**
 * 从密钥生成TOTP验证码
 * @param {string} secret - Base32编码的密钥字符串
 * @param {Object} options - 可选配置
 * @param {number} options.step - 时间步长（秒），默认30秒
 * @param {number} options.digits - 验证码位数，默认6位
 * @param {string} options.encoding - 密钥编码格式，默认'base32'
 * @returns {string} 6位数字验证码
 *
 * @example
 * const code = generateTOTP('JBSWY3DPEHPK3PXP');
 * console.log(code); // '123456'
 */
function generateTOTP(secret, options = {}) {
	if (!secret) {
		throw new Error('密钥不能为空');
	}

	const { step = 30, digits = 6, encoding = 'base32' } = options;

	try {
		const token = speakeasy.totp({
			secret,
			encoding,
			step,
			digits,
		});

		return token;
	} catch (error) {
		throw new Error(`生成TOTP验证码失败: ${error.message}`);
	}
}

/**
 * 验证TOTP验证码是否有效
 * @param {string} token - 用户输入的验证码
 * @param {string} secret - Base32编码的密钥字符串
 * @param {Object} options - 可选配置
 * @param {number} options.window - 允许的时间窗口（默认为1，即允许前后各30秒）
 * @param {number} options.step - 时间步长（秒），默认30秒
 * @param {number} options.digits - 验证码位数，默认6位
 * @param {string} options.encoding - 密钥编码格式，默认'base32'
 * @returns {boolean} 验证是否通过
 */
function verifyTOTP(token, secret, options = {}) {
	if (!token || !secret) {
		throw new Error('验证码和密钥不能为空');
	}

	const { window = 1, step = 30, digits = 6, encoding = 'base32' } = options;

	try {
		const verified = speakeasy.totp.verify({
			secret,
			encoding,
			token,
			step,
			digits,
			window,
		});

		return verified;
	} catch (error) {
		throw new Error(`验证TOTP验证码失败: ${error.message}`);
	}
}

/**
 * 从otpauth URI中解析密钥信息
 * @param {string} uri - otpauth://totp/... 格式的URI
 * @returns {Object} 包含 secret、issuer、label 等信息的对象
 *
 * @example
 * const info = parseOtpauthUri('otpauth://totp/Example:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example');
 * console.log(info.secret); // 'JBSWY3DPEHPK3PXP'
 */
function parseOtpauthUri(uri) {
	if (!uri || !uri.startsWith('otpauth://')) {
		throw new Error('无效的otpauth URI格式');
	}

	try {
		const url = new URL(uri);
		const secret = url.searchParams.get('secret');
		const issuer = url.searchParams.get('issuer');
		const algorithm = url.searchParams.get('algorithm') || 'SHA1';
		const digits = parseInt(url.searchParams.get('digits') || '6', 10);
		const period = parseInt(url.searchParams.get('period') || '30', 10);

		// 从路径中提取label (例如: /totp/Example:user@example.com)
		const pathParts = url.pathname.split('/');
		const label = pathParts[pathParts.length - 1];

		if (!secret) {
			throw new Error('URI中缺少secret参数');
		}

		return {
			secret,
			issuer,
			label: decodeURIComponent(label),
			algorithm,
			digits,
			period,
		};
	} catch (error) {
		throw new Error(`解析otpauth URI失败: ${error.message}`);
	}
}

/**
 * 生成新的2FA密钥
 * @param {Object} options - 配置选项
 * @param {string} options.name - 账号标识（如邮箱或用户名）
 * @param {string} options.issuer - 签发者名称（如应用名称）
 * @returns {Object} 包含 secret、otpauthUrl、qrCodeUrl 的对象
 *
 * @example
 * const newSecret = generateSecret({ name: 'user@example.com', issuer: 'AnyRouter' });
 * console.log(newSecret.secret); // Base32密钥
 * console.log(newSecret.otpauthUrl); // otpauth:// URI
 */
function generateSecret(options = {}) {
	const { name = 'User', issuer = 'AnyRouter' } = options;

	const secret = speakeasy.generateSecret({
		name,
		issuer,
		length: 32,
	});

	return {
		secret: secret.base32,
		otpauthUrl: secret.otpauth_url,
		// 可以使用此URL生成二维码: https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=
		qrCodeUrl: `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(secret.otpauth_url)}`,
	};
}

/**
 * 获取当前验证码及剩余有效时间
 * @param {string} secret - Base32编码的密钥字符串
 * @param {number} step - 时间步长（秒），默认30秒
 * @returns {Object} 包含 code（验证码）和 remaining（剩余秒数）的对象
 *
 * @example
 * const { code, remaining } = getCurrentCode('JBSWY3DPEHPK3PXP');
 * console.log(`验证码: ${code}, 剩余有效时间: ${remaining}秒`);
 */
function getCurrentCode(secret, step = 30) {
	const code = generateTOTP(secret, { step });
	const epoch = Math.floor(Date.now() / 1000);
	const remaining = step - (epoch % step);

	return {
		code,
		remaining,
	};
}

export { generateTOTP, verifyTOTP, parseOtpauthUri, generateSecret, getCurrentCode };
