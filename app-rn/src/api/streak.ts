import { api } from './client';

function unwrap<T>(p: Promise<{ data: { data?: T } & T }>): Promise<T> {
  return p.then((r) => {
    const body = r.data as any;
    return (body?.data ?? body) as T;
  });
}

export interface StreakStatus {
  current: number;
  longest: number;
  lastActiveDate: string | null;
  coins: number;
  /** Coins this day's login granted (= reward for the current streak day). */
  todayReward: number;
  milestones: number[];
}

/** Current daily-login streak + today's check-in reward (used by StreakModal). */
export const getStreakStatus = () => unwrap<StreakStatus>(api.get('/streak'));
