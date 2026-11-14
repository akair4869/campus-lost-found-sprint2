import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApplication } from "../server.mjs";

test("Version 3.0: finder handover, catalog admin, edit/withdraw, post reports and analytics", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "campus-features-")),
    dbPath = join(dir, "test.sqlite");
  let app = createApplication({ dbPath });
  app.seedDemo();
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  let base = "http://127.0.0.1:" + app.server.address().port;
  const cookies = {};
  async function request(path, data, actor = "guest", expected = 200) {
    const r = await fetch(base + path, {
      method: data === undefined ? "GET" : "POST",
      headers: {
        ...(cookies[actor] ? { Cookie: cookies[actor] } : {}),
        ...(data === undefined
          ? {}
          : { "Content-Type": "application/json", "X-Campus-Request": "1" }),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    const b = await r.json();
    assert.equal(r.status, expected, JSON.stringify(b));
    if (r.headers.get("set-cookie"))
      cookies[actor] = r.headers.get("set-cookie").split(";")[0];
    return b;
  }
  const base_item = {
    type: "lost",
    title: "Grey laptop sleeve",
    description: "Grey padded laptop sleeve with a small zip pocket.",
    category: "Bags & accessories",
    building: "Central Library",
    date: "2026-01-02",
    photo: null,
  };
  try {
    await request(
      "/api/login",
      { email: "student@campus.test", password: "CampusStudent123!" },
      "student",
    );
    await request(
      "/api/login",
      { email: "finder@campus.test", password: "CampusFinder123!" },
      "finder",
    );
    await request(
      "/api/login",
      { email: "staff@campus.test", password: "CampusStaff123!" },
      "staff",
    );

    await t.test("PBI-14 staff manage buildings and categories", async () => {
      const pub = await request("/api/catalog");
      assert.ok(pub.categories.some((c) => c.name === "Electronics"));
      assert.equal(pub.buildings.length, 5);
      await request(
        "/api/catalog",
        { kind: "building", action: "add", name: "Sports Hall" },
        "student",
        403,
      );
      await request(
        "/api/catalog",
        { kind: "building", action: "add", name: "Sports Hall", nameAr: "الصالة الرياضية" },
        "staff",
      );
      await request(
        "/api/catalog",
        { kind: "building", action: "add", name: "sports hall" },
        "staff",
        409,
      );
      // New building can be used in reports immediately
      const r = await request(
        "/api/items",
        { ...base_item, building: "Sports Hall", title: "Gym towel" },
        "student",
      );
      // Renaming updates existing reports
      await request(
        "/api/catalog",
        { kind: "building", action: "update", name: "Sports Hall", newName: "Sports Complex" },
        "staff",
      );
      const board = await request("/api/items?q=Gym+towel");
      assert.equal(board.items[0].id, r.id);
      assert.equal(board.items[0].building, "Sports Complex");
      // Disabled entries disappear for students and are rejected for new reports
      await request(
        "/api/catalog",
        { kind: "category", action: "update", name: "Clothing", active: false },
        "staff",
      );
      assert.ok(!(await request("/api/catalog")).categories.some((c) => c.name === "Clothing"));
      assert.ok(
        (await request("/api/catalog", undefined, "staff")).categories.some(
          (c) => c.name === "Clothing" && c.active === 0,
        ),
      );
      await request("/api/items", { ...base_item, category: "Clothing" }, "student", 400);
      await request(
        "/api/catalog",
        { kind: "category", action: "update", name: "Clothing", active: true },
        "staff",
      );
    });

    let lostId, foundId;
    await t.test("PBI-15 owners edit and withdraw their own reports", async () => {
      lostId = (await request("/api/items", base_item, "student")).id;
      await request("/api/items/update", { id: lostId, title: "Hacked" }, "finder", 404);
      await request("/api/items/update", { id: lostId, date: "2099-01-01" }, "student", 400);
      const edited = await request(
        "/api/items/update",
        { id: lostId, title: "Dark grey laptop sleeve", building: "Student Center" },
        "student",
      );
      assert.equal(edited.title, "Dark grey laptop sleeve");
      assert.equal(edited.building, "Student Center");
      assert.equal(edited.description, base_item.description);
      await request("/api/items/withdraw", { id: lostId, reason: "Found it at home" }, "finder", 404);
      const w = await request(
        "/api/items/withdraw",
        { id: lostId, reason: "Found it at home" },
        "student",
      );
      assert.equal(w.status, "withdrawn");
      assert.equal(w.withdrawReason, "Found it at home");
      assert.equal((await request("/api/items?q=Dark+grey")).total, 0);
      const mine = await request("/api/dashboard", undefined, "student");
      assert.ok(mine.items.some((i) => i.id === lostId && i.status === "withdrawn"));
      await request("/api/items/update", { id: lostId, title: "Again" }, "student", 409);

      // Found report: pending claims are closed when the finder withdraws it
      foundId = (
        await request(
          "/api/items",
          { ...base_item, type: "found", title: "Black umbrella", category: "Other", point: "library" },
          "finder",
        )
      ).id;
      await request(
        "/api/claims",
        { itemId: foundId, evidence: "It has a broken spoke near the handle." },
        "student",
      );
      await request("/api/items/withdraw", { id: foundId }, "finder");
      const claims = (await request("/api/dashboard", undefined, "student")).claims;
      const c = claims.find((x) => x.itemId === foundId);
      assert.equal(c.status, "rejected");
      // Items already at the desk cannot be withdrawn by the finder
      await request("/api/items/withdraw", { id: "sample-0" }, "finder", 409);
    });

    await t.test("PBI-16 users report posts and staff hide, dismiss or restore", async () => {
      await request("/api/flags", { itemId: "sample-3", reason: "false" }, "guest", 401);
      await request("/api/flags", { itemId: "sample-3", reason: "nonsense" }, "student", 400);
      await request("/api/flags", { itemId: "sample-3", reason: "false" }, "finder", 400);
      await request(
        "/api/flags",
        { itemId: "sample-3", reason: "false", details: "This was posted as a joke." },
        "student",
      );
      await request("/api/flags", { itemId: "sample-3", reason: "spam" }, "student", 409);
      const staffDash = await request("/api/dashboard", undefined, "staff");
      assert.ok(staffDash.notifications.some((n) => n.kind === "flagged"));
      await request("/api/flags", undefined, "student", 403);
      let q = await request("/api/flags", undefined, "staff");
      assert.equal(q.queue.length, 1);
      assert.equal(q.queue[0].flags[0].reason, "false");
      await request("/api/flags/review", { itemId: "sample-3", action: "hide", note: "" }, "staff", 400);
      await request(
        "/api/flags/review",
        { itemId: "sample-3", action: "hide", note: "Confirmed false report." },
        "staff",
      );
      assert.equal((await request("/api/items?q=headphones")).total, 0);
      q = await request("/api/flags", undefined, "staff");
      assert.equal(q.queue.length, 0);
      assert.equal(q.hidden.length, 1);
      const owner = await request("/api/dashboard", undefined, "finder");
      assert.ok(owner.notifications.some((n) => n.kind === "hidden"));
      assert.equal(
        owner.items.find((i) => i.id === "sample-3").hiddenNote,
        "Confirmed false report.",
      );
      await request("/api/flags/review", { itemId: "sample-3", action: "restore" }, "staff");
      assert.equal((await request("/api/items?q=headphones")).total, 1);
      // Dismiss keeps the post visible
      await request("/api/flags", { itemId: "sample-4", reason: "duplicate" }, "student");
      await request("/api/flags/review", { itemId: "sample-4", action: "dismiss" }, "staff");
      assert.equal((await request("/api/items?q=notebook")).total, 1);
      // Hidden found items cannot be claimed
      await request(
        "/api/flags/review",
        { itemId: "sample-2", action: "hide", note: "Duplicate of another post." },
        "staff",
      );
      await request(
        "/api/claims",
        { itemId: "sample-2", evidence: "Silver bottle with a dent on the bottom." },
        "student",
        409,
      );
    });

    await t.test("PBI-12 finder marks a found item as handed to security", async () => {
      const id = (
        await request(
          "/api/items",
          { ...base_item, type: "found", title: "Blue water flask", category: "Other", point: "library" },
          "finder",
        )
      ).id;
      await request("/api/items/handover", { id, confirmed: true }, "student", 404);
      await request("/api/items/handover", { id }, "finder", 400);
      const h = await request(
        "/api/items/handover",
        { id, confirmed: true, note: "Gave it to the library desk officer" },
        "finder",
      );
      assert.equal(h.status, "awaiting");
      assert.ok(h.handedOverAt);
      assert.equal(h.handoverNote, "Gave it to the library desk officer");
      await request("/api/items/handover", { id, confirmed: true }, "finder", 409);
      // Public board shows the handover time but not the private note
      const pub = (await request("/api/items?q=water+flask")).items[0];
      assert.ok(pub.handedOverAt);
      assert.equal(pub.handoverNote, undefined);
      const staffDash = await request("/api/dashboard", undefined, "staff");
      assert.ok(staffDash.notifications.some((n) => n.kind === "handedOver" && n.itemId === id));
      // Once handed over, the finder cannot withdraw it or move it to another desk
      await request("/api/items/withdraw", { id }, "finder", 409);
      await request("/api/items/update", { id, point: "student" }, "finder", 409);
      await request("/api/items/update", { id, title: "Blue metal water flask" }, "finder");
      // Staff still confirm physical receipt
      const a = await request("/api/analytics", undefined, "staff");
      assert.equal(a.totals.handedOver, 1);
      const r = await request(
        "/api/checkin",
        { id, reference: "LIB-0042", confirmed: true },
        "staff",
      );
      assert.equal(r.status, "received");
      await request("/api/items/handover", { id, confirmed: true }, "finder", 409);
    });

    await t.test("PBI-13 staff analytics dashboard data", async () => {
      await request("/api/analytics", undefined, "student", 403);
      const a = await request("/api/analytics", undefined, "staff");
      assert.equal(a.totals.withdrawn, 2);
      assert.equal(a.totals.hidden, 1);
      assert.equal(
        a.totals.reports,
        a.totals.lost + a.totals.found,
      );
      assert.ok(a.byCategory.some((c) => c.name === "Electronics" && c.lost === 1));
      assert.ok(a.byBuilding.some((b) => b.name === "Sports Complex"));
      assert.equal(a.byPoint.length, 3);
      assert.equal(a.monthly.length, 6);
      assert.equal(a.flags.actioned, 1);
      assert.equal(a.flags.dismissed, 1);
    });

    await t.test("data persists after restart", async () => {
      await app.close();
      app = createApplication({ dbPath });
      await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
      base = "http://127.0.0.1:" + app.server.address().port;
      const c = await request("/api/catalog");
      assert.ok(c.buildings.some((b) => b.name === "Sports Complex"));
      assert.ok(!c.buildings.some((b) => b.name === "Sports Hall"));
    });
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
});
