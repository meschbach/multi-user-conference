const faker = require('faker');
const {expect} = require("chai");

const {tracer} = require("./test-junk.js");

const {MultiUserConferenceClient, Chat} = require("../client/client");
const {MultiUserConferenceServer} = require("../service/service");

describe("Rooms", function (){
	let span;
	beforeEach(function (){
		span = tracer.startSpan(this.currentTest.fullTitle(), {tags: {test:true}});
	});
	afterEach(function (){
		if( this.currentTest.state == "failed"){
			span.setTag("error", true);
			span.setTag("failed", true);
			span.log({event:"failure", reason: this.currentTest.err});
		}
		span.finish();
	});

	let service, address;
	beforeEach(async function (){
		service = new MultiUserConferenceServer(tracer);
		address = await service.startInProcess();
	});
	afterEach(function (){
		service.end();
	});

	describe("Given a new user", function (){
		let client;
		beforeEach(async function (){
			client = new MultiUserConferenceClient(tracer);
			await client.connect(address, span);
		});
		afterEach(function (){
			if(client) {
				client.end();
			}
		});

		describe("When the user logs in", function (){
			let userName;
			beforeEach(async function (){
				userName = faker.internet.userName();
				await client.register(userName, faker.internet.password(), span);
			});

			it("Notifies the user which room they are in", async function (){
				const room = await client.loadRoom(client.currentRoom, span);
				expect(room.name).to.equal("Foyer", span);
			});

			it("Can get a description of the room", async function (){
				const room = await client.loadRoom(client.currentRoom, span);
				expect(room.description).to.equal("You are at the entrance of the conference complex");
			});

			describe("When the user changes rooms", function (){
				it("observers the current room changed", async function (){
					const firstRoom = client.currentRoom;
					await client.exitRoom("in", span);
					expect( client.currentRoom ).to.not.eq(firstRoom);
				});
			});
		});
	});
});
