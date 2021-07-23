import supertest from "supertest";
import app from "../../src/app";
import connection from "../../src/database";

import * as songFactorie from "./factories/songFactorie";

beforeEach(async () => {
  await connection.query("DELETE FROM songs");
});

afterAll(() => {
  connection.end();
});

describe("POST /recommendations", () => {
  it("should answer with status 200 and add song for valid params", async () => {
    const newSong = songFactorie.body(true);
    
    const response = await supertest(app).post("/recommendations").send(newSong);
    expect(response.status).toBe(201);

    const songs = await connection.query("SELECT * FROM songs");
    const song = songs.rows[0]
    expect(song?.name).toBe(newSong.name);
  });

  it("should answer with status 400 for invalid params", async () => {
    const invalidSong = songFactorie.body(false);

    const response = await supertest(app).post("/recommendations").send(invalidSong);
    expect(response.status).toBe(400);
  });

  it("should return status 409 for duplicate name", async () => {
    await songFactorie.create();
    const song = songFactorie.body(true);

    const response = await supertest(app).post("/recommendations").send(song);
    expect(response.status).toBe(409);
  })
});

describe("POST /recommendations/:id/upvote", () => {
  it("should return status 404 for invalid song id", async () => {
      const response = await supertest(app).post("/recommendations/1/upvote");
      expect(response.status).toBe(404);
  });

  it("should return status 200 for valid id and add 1 to the score", async () => {
      const id = await songFactorie.create();

      const response = await supertest(app).post(`/recommendations/${id}/upvote`);
      expect(response.status).toBe(200);

      const requestScore = await connection.query(`
      SELECT score FROM songs WHERE id = $1
      `, [id]);
      expect(requestScore.rows[0]?.score).toBe(1);
  });
});

describe("POST /recommendations/:id/downvote", () => {
  it("should return status 404 for invalid song id", async () => {
      const response = await supertest(app).post("/recommendations/1/downvote");
      expect(response.status).toBe(404);
  });

  it("should return status 200 for valid id and remove 1 from the score", async () => {
      const id = await songFactorie.create();

      const response = await supertest(app).post(`/recommendations/${id}/downvote`);
      expect(response.status).toBe(200);

      const requestScore = await connection.query(`
      SELECT score FROM songs WHERE id = $1
      `, [id]);
      expect(requestScore.rows[0]?.score).toBe(-1);
  });

  it("should return status 200 and delete if score equals -5 on request", async () => {
      const { name, youtubeLink } = songFactorie.body(true);
      const newSong = await connection.query(`
      INSERT INTO songs (name, "youtubeLink", score) VALUES ($1, $2, -5) RETURNING id
      `, [name, youtubeLink]);
      const id = newSong.rows[0]?.id;

      const response = await supertest(app).post(`/recommendations/${id}/downvote`);
      expect(response.status).toBe(200);

      const request = await connection.query(`
      SELECT * FROM songs WHERE id = $1
      `, [id]);
      expect(request.rows[0]).toBe(undefined);
  })
});

describe("POST /recommendations/random", () => {
  it("should return status 404 for no songs registered", async () => {
      const response = await supertest(app).get("/recommendations/random");
      expect(response.status).toBe(404);
  });

  it("should return a song object for songs available", async () => {
    await songFactorie.create();
    const response = await supertest(app).get("/recommendations/random");
    
    expect(response.body).toEqual(expect.objectContaining({ 
      id: expect.any(Number), 
      name: expect.any(String), 
      youtubeLink: expect.any(String), 
      score: expect.any(Number)
    }));
  });
});