/**
 * 通知模块
 */

import nodemailer from 'nodemailer';

class NotificationKit {
	constructor() {
		this.emailUser = process.env.EMAIL_USER || '';
		this.emailPass = process.env.EMAIL_PASS || '';
		this.emailTo = process.env.EMAIL_TO || '';
	}

	/**
	 * 发送邮件通知
	 * @param {string} title - 邮件标题
	 * @param {string} content - 邮件内容
	 * @param {string} msgType - 消息类型 'text' 或 'html'
	 * @param {string} customEmailTo - 自定义接收邮箱(可选)
	 */
	async sendEmail(title, content, msgType = 'text', customEmailTo = null) {
		const emailTo = customEmailTo || this.emailTo;

		if (!this.emailUser || !this.emailPass || !emailTo) {
			throw new Error('邮箱配置未设置');
		}

		const transporter = nodemailer.createTransport({
			host: `smtp.${this.emailUser.split('@')[1]}`,
			port: 465,
			secure: true,
			auth: {
				user: this.emailUser,
				pass: this.emailPass,
			},
		});

		const mailOptions = {
			from: `AnyRouter Assistant <${this.emailUser}>`,
			to: emailTo,
			subject: title,
		};

		if (msgType === 'html') {
			mailOptions.html = content;
		} else {
			mailOptions.text = content;
		}

		await transporter.sendMail(mailOptions);
	}
	/**
	 * 推送消息到所有配置的通知渠道
	 * @param {string} title - 消息标题
	 * @param {string} content - 消息内容
	 * @param {string} msgType - 消息类型 'text' 或 'html'
	 * @param {string} customEmailTo - 自定义接收邮箱(可选)
	 */
	async pushMessage(title, content, msgType = 'text', customEmailTo = null) {
		try {
			await this.sendEmail(title, content, msgType, customEmailTo);
		} catch (error) {
			console.log(`[邮件]: 消息推送失败! 原因: ${error.message}`);
		}
	}
}

export default NotificationKit;
