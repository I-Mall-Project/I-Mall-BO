import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_ID,
    pass: process.env.GMAIL_PASS, // App Password
  },
});

const sendEmail = async (to, subject, html) => {
  try {
    const info = await transporter.sendMail({
      from: `"I-Mall" <${process.env.GMAIL_ID}>`,
      to,
      subject,
      html,
    });

    console.log("Email sent:", info.response);
    return true;
  } catch (error) {
    console.error("Email send failed:", error);
    throw error;
  }
};

export default sendEmail;
