const nodemailer = require('nodemailer');
const db = require("../config/db");

// Configure your email service
const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false, // true for port 465, false for port 587
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD
  }
});

exports.sendTeamInviteEmail = async ({ recipientEmail, recipientName, senderName }) => {
  try {
    const mailOptions = {
      from: `"TunProjects Team" <${process.env.EMAIL_FROM}>`,
      to: recipientEmail,
      subject: `Team Invitation from ${senderName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">You've been invited to join a team!</h2>
          <p>Hello ${recipientName},</p>
          <p>${senderName} has invited you to join their team on TunProjects.</p>
          <p>Please log in to your account to accept or decline the invitation.</p>
          <a href="${process.env.APP_URL}/teams/invitations" 
             style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
            View Invitation
          </a>
          <p style="margin-top: 30px;">The TunProjects Team</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending team invite email:', error);
    throw error;
  }
};

exports.sendTeamRequestUpdateEmail = async ({ recipientEmail, recipientName, teamName, status }) => {
  try {
    const action = status === 'accepted' ? 'accepted' : 'declined';
    const subject = `Team Invitation ${action}`;
    const actionText = status === 'accepted' 
      ? `has joined your team ${teamName}` 
      : `has declined to join your team ${teamName}`;

    const mailOptions = {
      from: `"TunProjects Team" <${process.env.EMAIL_FROM}>`,
      to: recipientEmail,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Team Invitation Update</h2>
          <p>Hello ${recipientName},</p>
          <p>${recipientName} ${actionText}.</p>
          <a href="${process.env.APP_URL}/teams" 
             style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
            View Team
          </a>
          <p style="margin-top: 30px;">The TunProjects Team</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending team update email:', error);
    throw error;
  }
};

// For admin notifications
exports.sendVerificationApprovedEmail = async ({ recipientEmail, recipientName, notes }) => {
  try {
    const mailOptions = {
      from: `"TunProjects Team" <${process.env.EMAIL_FROM}>`,
      to: recipientEmail,
      subject: `Worker Verification Approved`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Worker Verification Approved</h2>
          <p>Hello ${recipientName},</p>
          <p>Your worker verification request has been approved!</p>
          ${notes ? `<p><strong>Admin Notes:</strong> ${notes}</p>` : ''}
          <p>You can now apply to projects as a verified worker.</p>
          <a href="${process.env.APP_URL}/dashboard" 
             style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
            Go to Dashboard
          </a>
          <p style="margin-top: 30px;">The TunProjects Team</p>
        </div>
      `
    };
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending verification approved email:', error);
    throw error;
  }
};

exports.sendVerificationRejectedEmail = async ({ recipientEmail, recipientName, notes }) => {
  try {
    const mailOptions = {
      from: `"TunProjects Team" <${process.env.EMAIL_FROM}>`,
      to: recipientEmail,
      subject: `Worker Verification Rejected`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Worker Verification Rejected</h2>
          <p>Hello ${recipientName},</p>
          <p>Your worker verification request has been rejected.</p>
          ${notes ? `<p><strong>Reason:</strong> ${notes}</p>` : ''}
          <p>You can submit a new verification request after addressing the issues.</p>
          <a href="${process.env.APP_URL}/verification" 
             style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
            Submit New Request
          </a>
          <p style="margin-top: 30px;">The TunProjects Team</p>
        </div>
      `
    };
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending verification rejected email:', error);
    throw error;
  }
};

exports.sendVerificationRequestEmail = async ({ adminEmail, workerName, workerId }) => {
  try {
    const mailOptions = {
      from: `"TunProjects Team" <${process.env.EMAIL_FROM}>`,
      to: adminEmail,
      subject: `New Worker Verification Request`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">New Worker Verification Request</h2>
          <p>Hello Admin,</p>
          <p>A new worker verification request has been submitted by ${workerName}.</p>
          <p>Please review the request and take appropriate action.</p>
          <a href="${process.env.APP_URL}/admin/verifications/${workerId}" 
             style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
            Review Request
          </a>
          <p style="margin-top: 30px;">The TunProjects Team</p>
        </div>
      `
    };
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending verification request email:', error);
    throw error;
  }
};

exports.sendApplicationAcceptedEmail = async ({ workerEmail, workerName, projectTitle, clientName }) => {
  try {
    const mailOptions = {
      from: `"TunProjects Team" <${process.env.EMAIL_FROM}>`,
      to: workerEmail,
      subject: `Application Accepted for ${projectTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Application Accepted!</h2>
          <p>Hello ${workerName},</p>
          <p>Great news! Your application for the project "${projectTitle}" has been accepted by ${clientName}.</p>
          <p>The project is now in progress and you can start working on it.</p>
          <a href="${process.env.APP_URL}/projects/${projectTitle}" 
             style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
            View Project
          </a>
          <p style="margin-top: 30px;">The TunProjects Team</p>
        </div>
      `
    };
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending application accepted email:', error);
    throw error;
  }
};

exports.sendTeamCreationEmail = async ({ recipientEmail, recipientName, teamName }) => {
  try {
    const mailOptions = {
      from: `"TunProjects Team" <${process.env.EMAIL_FROM}>`,
      to: recipientEmail,
      subject: `Team Created Successfully`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Team Created Successfully!</h2>
          <p>Hello ${recipientName},</p>
          <p>Your team "${teamName}" has been created successfully.</p>
          <p>You are now the team leader and can start inviting members to join your team.</p>
          <a href="${process.env.APP_URL}/teams" 
             style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
            View Team
          </a>
          <p style="margin-top: 30px;">The TunProjects Team</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending team creation email:', error);
    throw error;
  }
};

exports.sendTeamMemberJoinedEmail = async ({ recipientEmail, recipientName, teamName, newMemberName }) => {
  try {
    const mailOptions = {
      from: `"TunProjects Team" <${process.env.EMAIL_FROM}>`,
      to: recipientEmail,
      subject: `New Team Member Joined`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">New Team Member Joined!</h2>
          <p>Hello ${recipientName},</p>
          <p>${newMemberName} has joined your team "${teamName}".</p>
          <p>You can now collaborate on projects together.</p>
          <a href="${process.env.APP_URL}/teams" 
             style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
            View Team
          </a>
          <p style="margin-top: 30px;">The TunProjects Team</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending team member joined email:', error);
    throw error;
  }
};

exports.sendTaskStatusUpdateEmail = async ({ recipientEmail, recipientName, workerName, projectTitle, status, projectId }) => {
  try {
    const subject = status === 'completed' ? 'Subtask Completed' : 'Subtask Started';
    const actionText = status === 'completed' ? 'completed' : 'started working on';

    const mailOptions = {
      from: `"TunProjects Team" <${process.env.EMAIL_FROM}>`,
      to: recipientEmail,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">${subject}</h2>
          <p>Hello ${recipientName},</p>
          <p>${workerName} has ${actionText} a subtask in project "${projectTitle}".</p>
          <a href="${process.env.APP_URL}/projects/${projectId}" 
             style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
            View Project
          </a>
          <p style="margin-top: 30px;">The TunProjects Team</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending task status update email:', error);
    throw error;
  }
};