import User from '../models/User';

class PlaytimeTracker {
  // Map userId -> startTime (ms)
  private activeSessions = new Map<string, number>();

  /**
   * Start tracking playtime for a user
   * @param userId The User ID from the database
   */
  startSession(userId: string) {
    if (!userId) return;
    if (this.activeSessions.has(userId)) return; // Already tracking

    this.activeSessions.set(userId, Date.now());
    console.log(`⏱️ Playtime tracking started for user ${userId}`);
  }

  /**
   * Stop tracking and save progress to DB
   * @param userId The User ID from the database
   */
  async endSession(userId: string) {
    if (!userId) return;
    const startTime = this.activeSessions.get(userId);

    // If not tracking, do nothing
    if (!startTime) return;

    // Calculate duration
    const durationMs = Date.now() - startTime;
    const durationSeconds = Math.floor(durationMs / 1000); // Convert to seconds

    // Remove from active sessions
    this.activeSessions.delete(userId);

    // Ignore short sessions (less than 10 seconds) to prevent spam
    if (durationSeconds < 10) return;

    try {
      const user = await User.findById(userId);
      if (!user) return;

      // 1. Update Totals
      user.totalPlaytimeSeconds = (user.totalPlaytimeSeconds || 0) + durationSeconds;
      user.playtimeBufferSeconds = (user.playtimeBufferSeconds || 0) + durationSeconds;

      // 2. Check for Point Awards
      // Rule: Every 30 Minutes (1800s) = 25 Points
      const POINTS_PER_INTERVAL = 25;
      const SECONDS_PER_INTERVAL = 1800; // 30 minutes

      const intervalsEarned = Math.floor(user.playtimeBufferSeconds / SECONDS_PER_INTERVAL);

      if (intervalsEarned > 0) {
        const pointsEarned = intervalsEarned * POINTS_PER_INTERVAL;
        user.points = (user.points || 0) + pointsEarned;

        // Keep the remainder in the buffer
        user.playtimeBufferSeconds = user.playtimeBufferSeconds % SECONDS_PER_INTERVAL;

        console.log(`🎉 User ${user.username} earned ${pointsEarned} points! Total Points: ${user.points}`);
      }

      await user.save();
      console.log(`⏱️ Playtime saved for ${user.username}: +${durationSeconds}s`);

    } catch (error) {
      console.error('Error saving playtime:', error);
    }
  }
}

export const playtimeTracker = new PlaytimeTracker();
