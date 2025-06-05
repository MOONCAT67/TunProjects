//teamService
const db = require("../config/db");
const notificationService = require("./notificationService");
const emailService = require("./emailService");

exports.createTeam = async (params) => {
  const { workerId, name, description } = params;

  if (!workerId) throw { message: "workerId was not provided", statusCode: 400 };
  if (!name) throw { message: "name was not provided", statusCode: 400 };

  const connection = await db.getConnection();
      try {
    await connection.beginTransaction();

        // Create the team
    const [teamResult] = await connection.query(
      `INSERT INTO teams (name, description, leader_id, is_active) VALUES (?, ?, ?, 1)`,
          [name, description || '', workerId]
        );

        const teamId = teamResult.insertId;

        // Add the creator as team leader
    await connection.query(
          `INSERT INTO team_memberships (team_id, worker_id, role) VALUES (?, ?, 'leader')`,
          [teamId, workerId]
        );

        // Get leader info for notification
    const [leader] = await connection.query(
          `SELECT fullname, email FROM users WHERE id = ?`,
          [workerId]
        );

        // Send welcome email to leader
        await emailService.sendTeamCreationEmail({
          recipientEmail: leader[0].email,
          recipientName: leader[0].fullname,
          teamName: name
        });

    await connection.commit();
    return {
          statusCode: 201,
          message: "Team created successfully",
          teamId
    };

      } catch (err) {
    await connection.rollback();
    throw { 
          message: err.message || "Failed to create team", 
          statusCode: err.statusCode || 500 
    };
  } finally {
    connection.release();
      }
};

exports.sendTeamRequest = async (params) => {
  const { senderId, userEmail } = params;

  if (!senderId) throw { message: "senderId was not provided", statusCode: 400 };
  if (!userEmail) throw { message: "userEmail was not provided", statusCode: 400 };

  const connection = await db.getConnection();
      try {
    await connection.beginTransaction();

        // Get recipient user
    const [users] = await connection.query(
          `SELECT id, fullname, email FROM users WHERE email = ?`,
          [userEmail]
        );

        if (users.length === 0) {
          throw { message: "User not found", statusCode: 404 };
        }

    const recipientId = users[0].id;
    const recipientName = users[0].fullname;
    const recipientEmail = users[0].email;

        // Check for existing request
    const [existing] = await connection.query(
          `SELECT id FROM team_request 
           WHERE sender_id = ? AND user_id = ? AND is_rejected = 0`,
      [senderId, recipientId]
        );

        if (existing.length > 0) {
          throw { message: "Request already sent", statusCode: 400 };
        }

    // Check if sender is in a team
    const [senderTeam] = await connection.query(
      `SELECT t.id, t.name, tm.role 
       FROM teams t
       JOIN team_memberships tm ON t.id = tm.team_id
       WHERE tm.worker_id = ? AND t.is_active = 1`,
      [senderId]
    );

    // Check if recipient is in a team
    const [recipientTeam] = await connection.query(
      `SELECT t.id, t.name, tm.role 
       FROM teams t
       JOIN team_memberships tm ON t.id = tm.team_id
       WHERE tm.worker_id = ? AND t.is_active = 1`,
      [recipientId]
    );

        // Create request
    await connection.query(
          `INSERT INTO team_request (sender_id, user_id, is_rejected) VALUES (?, ?, 0)`,
      [senderId, recipientId]
        );

        // Get sender info
    const [sender] = await connection.query(
          `SELECT fullname, email FROM users WHERE id = ?`,
          [senderId]
        );

    // Create appropriate notification based on team status
    let notificationTitle, notificationMessage;
    
    if (senderTeam.length > 0 && senderTeam[0].role === 'leader') {
      // Sender is a team leader inviting recipient
      notificationTitle = "Team Invitation";
      notificationMessage = `${sender[0].fullname} invites you to join their team ${senderTeam[0].name}`;
    } else if (recipientTeam.length > 0 && recipientTeam[0].role === 'leader') {
      // Recipient is a team leader, sender wants to join their team
      notificationTitle = "Join Team Request";
      notificationMessage = `${sender[0].fullname} wants to join your team ${recipientTeam[0].name}`;
    } else {
      // Neither is a team leader
      notificationTitle = "Team Request";
      notificationMessage = `${sender[0].fullname} sent you a team request`;
    }

        // Create notification
        await notificationService.createNotification({
      userId: recipientId,
      title: notificationTitle,
      message: notificationMessage,
          type: "team",
          referenceId: senderId
        });

        // Send email
        await emailService.sendTeamInviteEmail({
      recipientEmail: recipientEmail,
      recipientName: recipientName,
          senderName: sender[0].fullname
        });

    await connection.commit();
    return {
          statusCode: 201,
          message: "Team request sent successfully"
    };

      } catch (err) {
    await connection.rollback();
    throw { 
          message: err.message || "Failed to send team request", 
          statusCode: err.statusCode || 500 
    };
  } finally {
    connection.release();
      }
};

exports.acceptTeamRequest = async (params) => {
  const { requestId, userId } = params;

  if (!requestId) throw { message: "requestId was not provided", statusCode: 400 };
  if (!userId) throw { message: "userId was not provided", statusCode: 400 };

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // First, verify the request exists
    const [requestCheck] = await connection.query(
      `SELECT sender_id, user_id FROM team_request WHERE id = ?`,
      [requestId]
    );

    if (requestCheck.length === 0) {
          throw { message: "Request not found", statusCode: 404 };
        }

    const senderId = requestCheck[0].sender_id;
    const requestUserId = requestCheck[0].user_id;

    // Verify the user is either the sender or receiver of the request
    if (userId !== senderId && userId !== requestUserId) {
      throw { message: "Unauthorized to accept this request", statusCode: 403 };
    }

    // Get the team where the accepting user is a leader
    const [leaderTeam] = await connection.query(
      `SELECT t.id, t.name 
       FROM teams t
       JOIN team_memberships tm ON t.id = tm.team_id
       WHERE tm.worker_id = ? AND tm.role = 'leader' AND t.is_active = 1`,
      [userId]
    );

    if (leaderTeam.length === 0) {
      throw { message: "You are not a team leader", statusCode: 400 };
    }

    const teamId = leaderTeam[0].id;
    const teamName = leaderTeam[0].name;

    // Get user info for the joining user (the sender of the request)
    const [user] = await connection.query(
          `SELECT fullname, email FROM users WHERE id = ?`,
      [senderId]
    );

    if (user.length === 0) {
      throw { message: "User not found", statusCode: 404 };
    }

    // Check if joining user is already in a team
    const [currentMemberships] = await connection.query(
          `SELECT id, team_id FROM team_memberships WHERE worker_id = ?`,
      [senderId]
        );

    // If user is already in a team, remove them
        if (currentMemberships.length > 0) {
      await connection.query(
            `DELETE FROM team_memberships WHERE id = ?`,
            [currentMemberships[0].id]
          );
        }

    // Delete all other pending requests from this user
    await connection.query(
      `DELETE FROM team_request WHERE user_id = ? AND id != ?`,
      [senderId, requestId]
    );

    // Add user to team
    await connection.query(
          `INSERT INTO team_memberships (team_id, worker_id, role) VALUES (?, ?, 'member')`,
      [teamId, senderId]
        );

    // Delete the accepted request
    await connection.query(
          `DELETE FROM team_request WHERE id = ?`,
          [requestId]
        );

    // Notify both parties
        await notificationService.createNotification({
      userId: requestUserId,
          title: "Team Request Accepted",
          message: `${user[0].fullname} joined your team ${teamName}`,
          type: "team",
          referenceId: teamId
        });

    // Send emails to both parties
        await emailService.sendTeamRequestUpdateEmail({
          recipientEmail: user[0].email,
          recipientName: user[0].fullname,
          teamName,
          status: "accepted"
        });

    const [leader] = await connection.query(
          `SELECT email, fullname FROM users WHERE id = ?`,
      [userId]
        );

        await emailService.sendTeamMemberJoinedEmail({
      recipientEmail: leader[0].email,
      recipientName: leader[0].fullname,
          teamName,
          newMemberName: user[0].fullname
        });

    await connection.commit();
    return {
          statusCode: 200,
          message: "Team request accepted successfully"
    };

      } catch (err) {
    await connection.rollback();
    throw { 
          message: err.message || "Failed to accept team request", 
          statusCode: err.statusCode || 500 
    };
  } finally {
    connection.release();
      }
};

exports.rejectTeamRequest = async (params) => {
  const { requestId, userId } = params;

  if (!requestId) throw { message: "requestId was not provided", statusCode: 400 };
  if (!userId) throw { message: "userId was not provided", statusCode: 400 };

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Get request details with team information
    const [request] = await connection.query(
      `SELECT tr.sender_id, tr.user_id,
              sender_team.id as sender_team_id,
              sender_team.name as sender_team_name,
              sender_team.role as sender_team_role,
              recipient_team.id as recipient_team_id,
              recipient_team.name as recipient_team_name,
              recipient_team.role as recipient_team_role
       FROM team_request tr
       LEFT JOIN (
         SELECT t.id, t.name, tm.worker_id, tm.role
         FROM teams t
         JOIN team_memberships tm ON t.id = tm.team_id
         WHERE t.is_active = 1
       ) sender_team ON sender_team.worker_id = tr.sender_id
       LEFT JOIN (
         SELECT t.id, t.name, tm.worker_id, tm.role
         FROM teams t
         JOIN team_memberships tm ON t.id = tm.team_id
         WHERE t.is_active = 1
       ) recipient_team ON recipient_team.worker_id = tr.user_id
       WHERE tr.id = ?`,
      [requestId]
        );

        if (request.length === 0) {
          throw { message: "Request not found", statusCode: 404 };
        }

        const senderId = request[0].sender_id;
    const requestUserId = request[0].user_id;
    const senderTeamId = request[0].sender_team_id;
    const senderTeamName = request[0].sender_team_name;
    const recipientTeamId = request[0].recipient_team_id;
    const recipientTeamName = request[0].recipient_team_name;

    // Verify the user is either the sender or receiver of the request
    if (userId !== senderId && userId !== requestUserId) {
      throw { message: "Unauthorized to reject this request", statusCode: 403 };
    }

        // Get user info
    const [user] = await connection.query(
          `SELECT fullname, email FROM users WHERE id = ?`,
          [userId]
        );

    // Get other user info
    const [otherUser] = await connection.query(
      `SELECT fullname, email FROM users WHERE id = ?`,
      [userId === requestUserId ? senderId : requestUserId]
        );

        // Update request status
    await connection.query(
          `UPDATE team_request SET is_rejected = 1 
       WHERE id = ?`,
      [requestId]
    );

    // Create appropriate notification message based on who is rejecting
    let notificationTitle, notificationMessage, teamId, teamName;
    
    if (userId === requestUserId) {
      // If recipient is rejecting (rejecting invitation to join sender's team)
      if (!senderTeamId) {
        throw { message: "Sender is not in a team", statusCode: 400 };
      }
      notificationTitle = "Team Invitation Declined";
      notificationMessage = `${user[0].fullname} declined to join your team ${senderTeamName}`;
      teamId = senderTeamId;
      teamName = senderTeamName;
    } else {
      // If sender is rejecting (rejecting request to join their team)
      // Get the team where the rejecting user is a leader
      const [leaderTeam] = await connection.query(
        `SELECT t.id, t.name 
         FROM teams t
         JOIN team_memberships tm ON t.id = tm.team_id
         WHERE tm.worker_id = ? AND tm.role = 'leader' AND t.is_active = 1`,
        [userId]
      );

      if (leaderTeam.length === 0) {
        throw { message: "You are not a team leader", statusCode: 400 };
      }

      notificationTitle = "Join Request Declined";
      notificationMessage = `${user[0].fullname} declined your request to join their team ${leaderTeam[0].name}`;
      teamId = leaderTeam[0].id;
      teamName = leaderTeam[0].name;
    }

    // Notify the other party
        await notificationService.createNotification({
      userId: userId === requestUserId ? senderId : requestUserId,
      title: notificationTitle,
      message: notificationMessage,
          type: "team",
      referenceId: teamId
        });

    // Send email to the other party
          await emailService.sendTeamRequestUpdateEmail({
      recipientEmail: otherUser[0].email,
      recipientName: otherUser[0].fullname,
      teamName,
            status: "declined"
          });

    await connection.commit();
    return {
          statusCode: 200,
          message: "Team request rejected successfully"
    };

      } catch (err) {
    await connection.rollback();
    throw { 
          message: err.message || "Failed to reject team request", 
          statusCode: err.statusCode || 500 
    };
  } finally {
    connection.release();
      }
};

exports.getAllTeamMembers = async (params) => {
  const { userId } = params;

  if (!userId) throw { message: "userId was not provided", statusCode: 400 };

  try {
    // First get the team ID for this user
    const [userTeam] = await db.query(
      `SELECT t.id as team_id, t.name as team_name, t.description as team_description
       FROM teams t
       JOIN team_memberships tm ON t.id = tm.team_id
       WHERE tm.worker_id = ? AND t.is_active = 1`,
      [userId]
    );

    if (userTeam.length === 0) {
      return {
        statusCode: 200,
        message: "User is not a member of any team",
        data: {
          team: null,
          members: []
        }
      };
    }

    const teamId = userTeam[0].team_id;

    // Then get all members of this team
    const [members] = await db.query(
      `SELECT 
        u.id,
        u.fullname,
        u.email,
        u.profile_picture,
        tm.role,
        tm.joined_at,
        CASE WHEN t.leader_id = u.id THEN true ELSE false END as is_leader
       FROM team_memberships tm
       JOIN users u ON tm.worker_id = u.id
       JOIN teams t ON tm.team_id = t.id
       WHERE tm.team_id = ?`,
      [teamId]
    );

    return {
          statusCode: 200,
      message: `${members.length} team members found`,
      data: {
        team: {
          id: teamId,
          name: userTeam[0].team_name,
          description: userTeam[0].team_description
        },
        members: members
      }
    };
  } catch (err) {
    throw { 
      message: err.message || "Failed to get team members", 
      statusCode: err.statusCode || 500 
    };
  }
};

exports.getTeamRequests = async (params) => {
  const { userId } = params;

  if (!userId) throw { message: "userId was not provided", statusCode: 400 };

  try {
    const [results] = await db.query(
      `SELECT tr.id, tr.created_at, u.fullname, u.email, t.name as team_name
       FROM team_request tr
       JOIN users u ON tr.sender_id = u.id
       JOIN teams t ON t.leader_id = u.id
       WHERE tr.user_id = ? AND tr.is_rejected = 0`,
      [userId]
    );

    return {
          statusCode: 200,
          data: results
    };
  } catch (err) {
    throw { message: err, statusCode: 500 };
      }
};

exports.checkTeamRole = async (params) => {
  const { userId, teamId } = params;

  if (!userId) throw { message: "userId was not provided", statusCode: 400 };
  if (!teamId) throw { message: "teamId was not provided", statusCode: 400 };

  try {
    const [result] = await db.query(
      `SELECT role FROM team_memberships 
       WHERE worker_id = ? AND team_id = ?`,
      [userId, teamId]
    );

    if (result.length === 0) {
      throw { message: "User is not a member of this team", statusCode: 404 };
    }

    return {
      statusCode: 200,
      data: {
        role: result[0].role
      }
    };
  } catch (err) {
    throw { 
      message: err.message || "Failed to check team role", 
      statusCode: err.statusCode || 500 
    };
  }
};

exports.changeTeamLeader = async (params) => {
  const { currentLeaderId, newLeaderId, teamId } = params;

  if (!currentLeaderId || !newLeaderId || !teamId) {
    throw { message: "All parameters are required", statusCode: 400 };
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Verify current leader
    const [team] = await connection.query(
      `SELECT leader_id FROM teams WHERE id = ? AND leader_id = ? AND is_active = 1`,
      [teamId, currentLeaderId]
    );

    if (team.length === 0) {
      throw { message: "Unauthorized to change team leader", statusCode: 403 };
    }

    // Update team leader
    await connection.query(
      `UPDATE teams SET leader_id = ? WHERE id = ?`,
      [newLeaderId, teamId]
    );

    // Update roles in team_memberships
    await connection.query(
      `UPDATE team_memberships SET role = 'member' WHERE team_id = ? AND worker_id = ?`,
      [teamId, currentLeaderId]
    );

    await connection.query(
      `UPDATE team_memberships SET role = 'leader' WHERE team_id = ? AND worker_id = ?`,
      [teamId, newLeaderId]
    );

    // Get user info for notification
    const [users] = await connection.query(
      `SELECT u1.fullname as old_leader, u2.fullname as new_leader 
       FROM users u1, users u2 
       WHERE u1.id = ? AND u2.id = ?`,
      [currentLeaderId, newLeaderId]
    );

    // Create notifications
    await notificationService.createNotification({
      userId: currentLeaderId,
      title: "Team Leadership Change",
      message: `You are no longer the leader of the team`,
      type: "team",
      referenceId: teamId
    });

    await notificationService.createNotification({
      userId: newLeaderId,
      title: "Team Leadership Change",
      message: `You are now the leader of the team`,
      type: "team",
      referenceId: teamId
    });

    await connection.commit();
    return {
      statusCode: 200,
      message: "Team leader changed successfully"
    };

  } catch (err) {
    await connection.rollback();
    throw { 
      message: err.message || "Failed to change team leader", 
      statusCode: err.statusCode || 500 
    };
  } finally {
    connection.release();
  }
};

exports.deleteTeam = async (params) => {
  const { teamId, leaderId } = params;

  if (!teamId || !leaderId) {
    throw { message: "teamId and leaderId are required", statusCode: 400 };
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Verify team leader
    const [team] = await connection.query(
      `SELECT leader_id FROM teams WHERE id = ? AND leader_id = ? AND is_active = 1`,
      [teamId, leaderId]
    );

    if (team.length === 0) {
      throw { message: "Unauthorized to delete team", statusCode: 403 };
    }

    // Get team members for notifications
    const [members] = await connection.query(
      `SELECT worker_id FROM team_memberships WHERE team_id = ?`,
      [teamId]
    );

    // Delete team memberships
    await connection.query(
      `DELETE FROM team_memberships WHERE team_id = ?`,
      [teamId]
    );

    // Soft delete team
    await connection.query(
      `UPDATE teams SET is_active = 0 WHERE id = ?`,
      [teamId]
    );

    // Create notifications for all members
    for (const member of members) {
      await notificationService.createNotification({
        userId: member.worker_id,
        title: "Team Deleted",
        message: "The team you were part of has been deleted",
        type: "team",
        referenceId: teamId
      });
    }

    await connection.commit();
    return {
      statusCode: 200,
      message: "Team deleted successfully"
    };

  } catch (err) {
    await connection.rollback();
    throw { 
      message: err.message || "Failed to delete team", 
      statusCode: err.statusCode || 500 
    };
  } finally {
    connection.release();
  }
};

exports.kickTeamMember = async (params) => {
  const { teamId, leaderId, memberId } = params;

  if (!teamId || !leaderId || !memberId) {
    throw { message: "All parameters are required", statusCode: 400 };
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Verify team leader
    const [team] = await connection.query(
      `SELECT leader_id FROM teams WHERE id = ? AND leader_id = ? AND is_active = 1`,
      [teamId, leaderId]
    );

    if (team.length === 0) {
      throw { message: "Unauthorized to kick team members", statusCode: 403 };
    }

    // Remove member from team
    await connection.query(
      `DELETE FROM team_memberships WHERE team_id = ? AND worker_id = ?`,
      [teamId, memberId]
    );

    // Create notification for kicked member
    await notificationService.createNotification({
      userId: memberId,
      title: "Removed from Team",
      message: "You have been removed from the team",
      type: "team",
      referenceId: teamId
    });

    await connection.commit();
    return {
      statusCode: 200,
      message: "Team member removed successfully"
    };

  } catch (err) {
    await connection.rollback();
    throw { 
      message: err.message || "Failed to remove team member", 
      statusCode: err.statusCode || 500 
    };
  } finally {
    connection.release();
  }
};

exports.leaveTeam = async (params) => {
  const { teamId, userId } = params;

  if (!teamId || !userId) {
    throw { message: "teamId and userId are required", statusCode: 400 };
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Check if user is team leader
    const [team] = await connection.query(
      `SELECT leader_id FROM teams WHERE id = ? AND is_active = 1`,
      [teamId]
    );

    if (team.length === 0) {
      throw { message: "Team not found", statusCode: 404 };
    }

    if (team[0].leader_id === userId) {
      throw { message: "Team leader cannot leave the team. Please transfer leadership first.", statusCode: 400 };
    }

    // Remove member from team
    await connection.query(
      `DELETE FROM team_memberships WHERE team_id = ? AND worker_id = ?`,
      [teamId, userId]
    );

    // Notify team leader
    await notificationService.createNotification({
      userId: team[0].leader_id,
      title: "Team Member Left",
      message: "A team member has left the team",
      type: "team",
      referenceId: teamId
    });

    await connection.commit();
    return {
      statusCode: 200,
      message: "Successfully left the team"
    };

  } catch (err) {
    await connection.rollback();
    throw { 
      message: err.message || "Failed to leave team", 
      statusCode: err.statusCode || 500 
    };
  } finally {
    connection.release();
  }
};

// Get all teams for a user
exports.getUserTeams = async (params) => {
  const { userId } = params;

  if (!userId) throw { message: "userId was not provided", statusCode: 400 };

  try {
    const [teams] = await db.query(
      `SELECT t.*, 
              u.fullname as leader_name, 
              u.profile_picture as leader_picture,
              tm.role,
              (SELECT COUNT(*) FROM team_memberships WHERE team_id = t.id) as member_count
       FROM teams t
       JOIN team_memberships tm ON t.id = tm.team_id
       JOIN users u ON t.leader_id = u.id
       WHERE tm.worker_id = ? AND t.is_active = 1`,
      [userId]
    );

    return {
      statusCode: 200,
      teams: teams.map(team => ({
        id: team.id,
        name: team.name,
        description: team.description,
        role: team.role,
        leader_name: team.leader_name,
        leader_picture: team.leader_picture,
        member_count: team.member_count
      }))
    };
  } catch (err) {
    throw { 
      message: err.message || "Failed to get user teams", 
      statusCode: err.statusCode || 500 
    };
  }
};

exports.getWorkerJobs = async (params) => {
  const { workerId } = params;

  if (!workerId) throw { message: "workerId was not provided", statusCode: 400 };

  try {
    // Get worker's jobs with category information
    const [jobs] = await db.query(
      `SELECT 
        wj.id,
        wj.years_experience,
        wj.verification_date,
        jc.id as category_id,
        jc.name as category_name,
        jc.description as category_description,
        jc.icon as category_icon
       FROM worker_jobs wj
       JOIN job_categories jc ON wj.job_category_id = jc.id
       WHERE wj.worker_id = ? AND jc.is_active = 1`,
      [workerId]
    );

    if (jobs.length === 0) {
      return {
        statusCode: 200,
        message: "No jobs found for this worker",
        data: []
      };
    }

    return {
      statusCode: 200,
      message: `${jobs.length} jobs found`,
      data: jobs.map(job => ({
        id: job.id,
        years_experience: job.years_experience,
        verification_date: job.verification_date,
        category: {
          id: job.category_id,
          name: job.category_name,
          description: job.category_description,
          icon: job.category_icon
        }
      }))
    };
  } catch (err) {
    throw { 
      message: err.message || "Failed to get worker jobs", 
      statusCode: err.statusCode || 500 
    };
  }
};

exports.getTeamInfo = async (params) => {
  const { teamId } = params;

  if (!teamId) throw { message: "teamId was not provided", statusCode: 400 };

  try {
    // Get team info with leader and member count
    const [teams] = await db.query(
      `SELECT 
        t.id,
        t.name,
        t.description,
        t.created_at,
        u.id as leader_id,
        u.fullname as leader_name,
        u.email as leader_email,
        u.profile_picture as leader_picture,
        (SELECT COUNT(*) FROM team_memberships WHERE team_id = t.id) as member_count
       FROM teams t
       JOIN users u ON t.leader_id = u.id
       WHERE t.id = ? AND t.is_active = 1`,
      [teamId]
    );

    if (teams.length === 0) {
      return {
        statusCode: 200,
        message: "Team not found",
        data: null
      };
    }

    const team = teams[0];

    // Get team members
    const [members] = await db.query(
      `SELECT 
        u.id,
        u.fullname,
        u.email,
        u.profile_picture,
        tm.role,
        tm.joined_at,
        CASE WHEN t.leader_id = u.id THEN true ELSE false END as is_leader
       FROM team_memberships tm
       JOIN users u ON tm.worker_id = u.id
       JOIN teams t ON tm.team_id = t.id
       WHERE tm.team_id = ?`,
      [teamId]
    );

    return {
      statusCode: 200,
      message: "Team information retrieved successfully",
      data: {
        id: team.id,
        name: team.name,
        description: team.description,
        created_at: team.created_at,
        leader: {
          id: team.leader_id,
          fullname: team.leader_name,
          email: team.leader_email,
          profile_picture: team.leader_picture
        },
        member_count: team.member_count,
        members: members
      }
    };
  } catch (err) {
    throw { 
      message: err.message || "Failed to get team information", 
      statusCode: err.statusCode || 500 
    };
  }
};

exports.getAllTeams = async () => {
  try {
    // Get all active teams with their leader and member count
    const [teams] = await db.query(
      `SELECT 
        t.id,
        t.name,
        t.description,
        t.created_at,
        u.id as leader_id,
        u.fullname as leader_name,
        u.email as leader_email,
        u.profile_picture as leader_picture,
        (SELECT COUNT(*) FROM team_memberships WHERE team_id = t.id) as member_count
       FROM teams t
       JOIN users u ON t.leader_id = u.id
       WHERE t.is_active = 1
       ORDER BY t.created_at DESC`
    );

    if (teams.length === 0) {
      return {
        statusCode: 200,
        message: "No teams found",
        data: []
      };
    }

    return {
      statusCode: 200,
      message: `${teams.length} teams found`,
      data: teams.map(team => ({
        id: team.id,
        name: team.name,
        description: team.description,
        created_at: team.created_at,
        leader: {
          id: team.leader_id,
          fullname: team.leader_name,
          email: team.leader_email,
          profile_picture: team.leader_picture
        },
        member_count: team.member_count
      }))
    };
  } catch (err) {
    throw { 
      message: err.message || "Failed to get teams", 
      statusCode: err.statusCode || 500 
    };
  }
};

exports.getTeamLeaderEmail = async (params) => {
  const { teamId } = params;

  if (!teamId) throw { message: "teamId was not provided", statusCode: 400 };

  try {
    // Get team leader's email
    const [teams] = await db.query(
      `SELECT 
        u.email as leader_email,
        u.fullname as leader_name
       FROM teams t
       JOIN users u ON t.leader_id = u.id
       WHERE t.id = ? AND t.is_active = 1`,
      [teamId]
    );

    if (teams.length === 0) {
      return {
        statusCode: 200,
        message: "Team not found",
        data: null
      };
    }

    return {
      statusCode: 200,
      message: "Team leader email retrieved successfully",
      data: {
        email: teams[0].leader_email,
        fullname: teams[0].leader_name
      }
    };
  } catch (err) {
    throw { 
      message: err.message || "Failed to get team leader email", 
      statusCode: err.statusCode || 500 
    };
  }
};

exports.getUserTeamRequests = async (params) => {
  const { userId } = params;

  if (!userId) throw { message: "userId was not provided", statusCode: 400 };

  try {
    // Get all team requests for the user with sender info and team status
    const [requests] = await db.query(
      `SELECT 
        tr.id as request_id,
        tr.is_rejected,
        u.id as sender_id,
        u.fullname as sender_name,
        u.email as sender_email,
        u.profile_picture as sender_picture,
        sender_team.id as sender_team_id,
        sender_team.name as sender_team_name,
        sender_team.role as sender_team_role,
        recipient_team.id as recipient_team_id,
        recipient_team.name as recipient_team_name,
        recipient_team.role as recipient_team_role
       FROM team_request tr
       LEFT JOIN users u ON tr.sender_id = u.id
       LEFT JOIN (
         SELECT t.id, t.name, tm.worker_id, tm.role
         FROM teams t
         JOIN team_memberships tm ON t.id = tm.team_id
         WHERE t.is_active = 1
       ) sender_team ON sender_team.worker_id = tr.sender_id
       LEFT JOIN (
         SELECT t.id, t.name, tm.worker_id, tm.role
         FROM teams t
         JOIN team_memberships tm ON t.id = tm.team_id
         WHERE t.is_active = 1
       ) recipient_team ON recipient_team.worker_id = tr.user_id
       WHERE tr.user_id = ? AND tr.is_rejected = 0
       ORDER BY tr.id DESC`,
      [userId]
    );

    if (requests.length === 0) {
      return {
        statusCode: 200,
        message: "No team requests found",
        data: []
      };
    }

    return {
      statusCode: 200,
      message: `${requests.length} team requests found`,
      data: requests.map(request => {
        // Determine request type and message
        let requestType, requestMessage;
        
        if (request.sender_team_role === 'leader' && request.recipient_team_role === 'leader') {
          requestType = 'leader_to_leader_join';
          requestMessage = `${request.sender_name} (leader of ${request.sender_team_name}) invites you to join their team with your team ${request.recipient_team_name}`;
        } else if (request.sender_team_role === 'leader') {
          requestType = 'to_worker_to_join_his_team';
          requestMessage = `${request.sender_name} invites you to join their team ${request.sender_team_name}`;
        } else if (request.recipient_team_role === 'leader') {
          requestType = 'to_leader_to_join_his_team';
          requestMessage = `${request.sender_name} wants to join your team ${request.recipient_team_name}`;
        } else {
          requestType = 'general';
          requestMessage = `${request.sender_name} sent you a team request`;
        }

        return {
          request_id: request.request_id,
          is_rejected: request.is_rejected,
          type: requestType,
          message: requestMessage,
          sender: {
            id: request.sender_id,
            fullname: request.sender_name,
            email: request.sender_email,
            profile_picture: request.sender_picture,
            team: request.sender_team_id ? {
              id: request.sender_team_id,
              name: request.sender_team_name,
              role: request.sender_team_role
            } : null
          },
          recipient_team: request.recipient_team_id ? {
            id: request.recipient_team_id,
            name: request.recipient_team_name,
            role: request.recipient_team_role
          } : null
        };
      })
    };
  } catch (err) {
    console.error('Error in getUserTeamRequests:', err);
    throw { 
      message: err.message || "Failed to get team requests", 
      statusCode: err.statusCode || 500 
    };
  }
};

exports.isTeamLeader = async (workerId) => {
  if (!workerId) throw { message: "workerId was not provided", statusCode: 400 };

  try {
    // Check if the worker exists and is a worker
    const [worker] = await db.query(
      "SELECT id, role FROM users WHERE id = ? AND role = 'worker'",
      [workerId]
    );

    if (worker.length === 0) {
      throw { message: "Worker not found", statusCode: 404 };
    }

    // Check if the worker is a leader of any team
    const [teams] = await db.query(
      "SELECT id, name, description, created_at FROM teams WHERE leader_id = ?",
      [workerId]
    );

    return {
      message: teams.length > 0 ? "Worker is a team leader" : "Worker is not a team leader",
      isLeader: teams.length > 0,
      teams: teams,
      statusCode: 200,
    };
  } catch (err) {
    throw {
      message: err.message || "Failed to check team leader status",
      statusCode: err.statusCode || 500,
    };
  }
};

exports.getUserAssignedSubTasks = async (userId, teamId) => {
  if (!userId || !teamId) {
    throw { message: "userId and teamId are required", statusCode: 400 };
  }

  const query = `
    SELECT DISTINCT
      st.*, 
      mt.id as main_task_id,
      mt.title AS main_task_title, 
      mt.description AS main_task_description, 
      mt.status AS main_task_status, 
      mt.deadline AS main_task_deadline,
      p.id as project_id,
      p.title AS project_title, 
      p.current_phase, 
      p.main_tasks_number, 
      p.status AS project_status
    FROM project_teams pt
    JOIN projects p ON pt.project_id = p.id
    JOIN main_tasks mt ON p.id = mt.project_id
    JOIN sub_tasks st ON mt.id = st.main_task_id
    WHERE pt.team_id = ?
      AND p.status = 'in progress'
      AND st.assigned_to = ?
      AND st.assigned_type = 'team'
    ORDER BY p.id, mt.id, st.id
  `;

  const [rows] = await db.query(query, [teamId, userId]);

  // Group the results by project and main task
  const groupedResults = rows.reduce((acc, row) => {
    // Initialize project if not exists
    if (!acc[row.project_id]) {
      acc[row.project_id] = {
        project_id: row.project_id,
        project_title: row.project_title,
        current_phase: row.current_phase,
        main_tasks_number: row.main_tasks_number,
        project_status: row.project_status,
        main_tasks: {}
      };
    }

    // Initialize main task if not exists
    if (!acc[row.project_id].main_tasks[row.main_task_id]) {
      acc[row.project_id].main_tasks[row.main_task_id] = {
        main_task_id: row.main_task_id,
        main_task_title: row.main_task_title,
        main_task_description: row.main_task_description,
        main_task_status: row.main_task_status,
        main_task_deadline: row.main_task_deadline,
        subtasks: []
      };
    }

    // Add subtask to the main task
    acc[row.project_id].main_tasks[row.main_task_id].subtasks.push({
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      progress_percentage: row.progress_percentage,
      deadline: row.deadline,
      assigned_to: row.assigned_to,
      assigned_type: row.assigned_type,
      created_at: row.created_at,
      completed_at: row.completed_at
    });

    return acc;
  }, {});

  // Convert the grouped results to an array format
  const formattedResults = Object.values(groupedResults).map(project => ({
    ...project,
    main_tasks: Object.values(project.main_tasks)
  }));

  return formattedResults;
};

exports.getTeamProjects = async (teamId) => {
  if (!teamId) throw { message: "teamId was not provided", statusCode: 400 };

  try {
    // Get all projects for the team
    const [projects] = await db.query(
      `SELECT p.*, 
              c.name as client_name,
              c.email as client_email,
              c.phone as client_phone
       FROM projects p
       JOIN project_teams pt ON p.id = pt.project_id
       LEFT JOIN clients c ON p.client_id = c.id
       WHERE pt.team_id = ?
       ORDER BY p.created_at DESC`,
      [teamId]
    );

    // For each project, get its main tasks and subtasks
    const projectsWithTasks = await Promise.all(
      projects.map(async (project) => {
        // Get main tasks
        const [mainTasks] = await db.query(
          `SELECT mt.*, 
                  u.fullname as assigned_to_name,
                  t.name as team_name
           FROM main_tasks mt
           LEFT JOIN users u ON mt.assigned_to = u.id AND mt.assigned_type = 'individual'
           LEFT JOIN teams t ON mt.assigned_to = t.id AND mt.assigned_type = 'team'
           WHERE mt.project_id = ?
           ORDER BY mt.sequence_order ASC`,
          [project.id]
        );

        // For each main task, get its subtasks
        const tasksWithSubtasks = await Promise.all(
          mainTasks.map(async (mainTask) => {
            const [subTasks] = await db.query(
              `SELECT st.*, 
                      u.fullname as assigned_to_name,
                      t.name as team_name
               FROM sub_tasks st
               LEFT JOIN users u ON st.assigned_to = u.id AND st.assigned_type = 'individual'
               LEFT JOIN teams t ON st.assigned_to = t.id AND st.assigned_type = 'team'
               WHERE st.main_task_id = ?
               ORDER BY st.created_at ASC`,
              [mainTask.id]
            );

            // Get attachments for main task
            const [mainTaskAttachments] = await db.query(
              `SELECT * FROM task_attachments 
               WHERE task_id = ? AND task_type = 'main'`,
              [mainTask.id]
            );

            // Get attachments for each subtask
            const subtasksWithAttachments = await Promise.all(
              subTasks.map(async (subTask) => {
                const [subTaskAttachments] = await db.query(
                  `SELECT * FROM task_attachments 
                   WHERE task_id = ? AND task_type = 'sub'`,
                  [subTask.id]
                );
                return {
                  ...subTask,
                  attachments: subTaskAttachments
                };
              })
            );

            return {
              ...mainTask,
              subtasks: subtasksWithAttachments,
              attachments: mainTaskAttachments
            };
          })
        );

        return {
          ...project,
          tasks: tasksWithSubtasks
        };
      })
    );

    return {
      statusCode: 200,
      message: "Team projects retrieved successfully",
      data: projectsWithTasks
    };

  } catch (err) {
    throw { 
      message: err.message || "Failed to get team projects", 
      statusCode: err.statusCode || 500 
    };
  }
};