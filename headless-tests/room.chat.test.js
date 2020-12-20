const faker = require('faker');
const {expect} = require("chai");
const {promiseEvent, parallel} = require("junk-bucket/future");

const {tracer} = require("./test-junk.js");

const {MultiUserConferenceClient, RoomEvents} = require("../client/client");
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

	describe("Given two users in a room", function (){
		let person1, person2;
		beforeEach(async function (){
			const registerUser = async (userName) => {
				const client = new MultiUserConferenceClient(tracer);
				await client.connect(address, span);
				await client.register(userName, span);
				return client;
			} ;
			[person1,person2] = await parallel([
				registerUser(faker.internet.userName()),
				registerUser(faker.internet.userName())
			]);
		});
		afterEach(function (){
			person1.end();
			person2.end();
		});

		describe("When a user says something", function (){
			it("is received by the other person", async function (){
				let heardPromise = promiseEvent(person1, RoomEvents.ChatBroadcast);

				const said = faker.lorem.words(5);
				await person2.sayInRoom(said, span);

				const heardEvent = await heardPromise;
				const heard = heardEvent.what;
				expect(heard).to.equal(said);
			});
		});
	});
});
