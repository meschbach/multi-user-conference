const faker = require('faker');
const {expect} = require("chai");

const {Future, promiseEvent, delay} = require("junk-bucket/future");
const EventEmitter = require("eventemitter3");
const WebSocket = require('ws');

const {MultiUserConferenceClient, Chat} = require("../client/client");
const {promiseEventWithin} = require("./junk");
const {MultiUserConferenceServer} = require("../service/service");

const {tracer} = require("./test-junk");

describe("Multi-User Conference", function (){
	let span;
	beforeEach(function (){
		span = tracer.startSpan(this.test.fullTitle());
	});
	afterEach(function (){
		if (this.currentTest.state === 'failed') {
			span.setTag("error", true);
		}
		span.finish();
	});

	let muc, address;
	beforeEach(async function (){
		muc = new MultiUserConferenceServer(tracer);
		address = await muc.startInProcess();
	});
	afterEach(async function (){
		muc.end();
	});

	describe("Given a new user", function (){
		describe("When that user successfully registers", function (){
			it("Then the user can whisper to themselves", async function (){
				const client = new MultiUserConferenceClient(tracer);
				try {
					await client.connect(address, span);
					const name = faker.internet.email();
					await client.register(name, span);
					const words = faker.random.words(5);
					const received = promiseEvent(client, Chat.Whisper);
					await client.whisper(name, words, span);
					expect((await received).message).to.eq(words);
				}finally {
					client.end();
				}
			});
		});
	});

	describe("Given two users", function (){
		describe("When one user whispers to another", function (){
			it("Then the receiving user gets the message", async function (){
				const message = faker.random.words(5);

				const userOneName = faker.internet.userName();
				const userOne = new MultiUserConferenceClient(tracer);
				await userOne.connect(address, span);
				try {
					await userOne.register(userOneName, span);

					const userTwoName = faker.internet.userName();
					const userTwo = new MultiUserConferenceClient(tracer);
					try {
						await userTwo.connect(address, span);
						await userTwo.register(userTwoName, span);
						const received = promiseEventWithin(userTwo, Chat.Whisper, 500);

						await userOne.whisper(userTwoName, message, span);
						expect((await received).message).to.eq(message);
					} finally {
						userTwo.end();
					}
				} finally {
					userOne.end();
				}
			});
		});
	});
});
