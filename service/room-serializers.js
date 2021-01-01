function serializeRoomDescription(room){
	if( !room ){
		throw new Error("Expected room got none");
	}
	const {id, name,description,exits} = room;
	const namedExits = exits ? Object.keys(exits) : [];
	return {
		id,
		name,
		description,
		exits: namedExits
	}
}

module.exports = {
	serializeRoomDescription
}
