const EventEmitter = require("events");

const {traceOp} = require("../common/trace");

const RoomEvents = {
	ChatBroadcast: Symbol("room.chat.broadcast")
}

class LoadedRoom extends EventEmitter{
	constructor({id, name,description,exits}) {
		super();
		this.id = id;
		this.name = name;
		this.description = description;
		this.exits = exits;
	}

	async broadcastChat(client, what, span){
		if( !client.userName ){
			throw new Error("client has not authenticated");
		}
		this.emit(RoomEvents.ChatBroadcast, {
			from: client,
			what,
			room: this,
			span
		});
	}
}


class RoomsService {
	constructor(tracer) {
		this.tracer = tracer;
		this.startRoom = 0;
		this.rooms = [
			new LoadedRoom({id: 0, name: "Foyer", description:"You are at the entrance of the conference complex", exits: {in: 1}}),
			new LoadedRoom({id: 1, name: "Lobby", description: "It's a lobby.  Peeps milling about", exits: {out: 0}})
		];
	}

	async load( id, parentSpan ){
		if( !parentSpan ){
			throw new Error("Context expected");
		}
		return await traceOp(async (span) => {
			if( id === undefined ){ throw new Error("bad id"); }
			const room = this.rooms[id];
			if( !room ){
				throw new Error("No such room " + id);
			}
			return room;
		}, "muc.service.rooms.load", this.tracer, parentSpan, {tags: {roomID: id}});
	}
}

module.exports = {
	RoomEvents,
	LoadedRoom,
	RoomsService
}
