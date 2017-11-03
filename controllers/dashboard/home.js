'use strict';
const Joi = require('joi');
const Duration = require('humanize-duration');
const { promisify } = require('util');

module.exports = {
  description: 'Dashboard',
  tags: ['web', 'metrics'],
  auth: 'admin',
  handler: async function (request, reply) {

    const params = Object.assign({}, request.query);
    const limit = params.limit;
    params.offset = (params.page - 1) * limit;

    const redis_llen = promisify(this.redis.llen.bind(this.redis));
    const eventQueue = await redis_llen('events');
    const roomReportQueue = await redis_llen('rooms_destroyed');

    const count = await this.db.rooms.count(params);
    const activeCount = await this.db.rooms.count_active();
    const sessionCount = await this.db.sessions.count_active();

    const sessionDayCount = await this.db.sessions.count_period({
      ts: new Date(),
      interval: '1 day'
    });
    const sessionWeekCount = await this.db.sessions.count_period({
      ts: new Date(),
      interval: '7 days'
    });

    const roomDayCount = await this.db.rooms.count_period({
      ts: new Date(),
      interval: '1 day'
    });
    const roomWeekCount = await this.db.rooms.count_period({
      ts: new Date(),
      interval: '7 days'
    });

    request.totalCount = count.count;

    const rooms = await this.db.rooms.all(params);
    const pagesArr = new Array(Math.ceil(request.totalCount / limit)).fill(0);

    for (const room of rooms) {
      const end = (room.ended_at || new Date(Date.now())).getTime();
      const start = room.created_at.getTime();

      room.duration = Duration(end - start);
    }
    rooms.sort((a, b) => {

      return a.created_at > b.created_at ? -1 : a.created_at < b.created_at ? 1 : 0;
    });

    return reply.view('list_of_rooms', {
      pages: pagesArr,
      data: rooms,
      eventQueue,
      roomReportQueue,
      activeRoomCount: activeCount.count,
      activeSessionCount: sessionCount.count,
      prevDayRoomCount: roomDayCount.count,
      prevWeekRoomCount: roomWeekCount.count,
      prevDaySessionCount: sessionDayCount.count,
      prevWeekSessionCount: sessionWeekCount.count
    });
  },
  validate: {
    query: {
      limit: Joi.number().default(25).min(1).max(100),
      page: Joi.number().positive().default(1)
    }
  }
};
