require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
const express = require("express");

const bot = new Telegraf(process.env.BOT_TOKEN);

const CHANNEL = "@kinolar_uzb1l";
const ADMIN_PASSWORD = "HPR";

// ================= STATES =================
let adminMode = {};
let addMovie = {};
let deleteMode = {};

// ================= FILE INIT =================
function ensure(file, def) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(def, null, 2));
  }
}

ensure("movies.json", {});
ensure("users.json", []);

// ================= LOAD / SAVE =================
const loadMovies = () => JSON.parse(fs.readFileSync("movies.json"));
const saveMovies = (d) => fs.writeFileSync("movies.json", JSON.stringify(d, null, 2));

const loadUsers = () => JSON.parse(fs.readFileSync("users.json"));
const saveUsers = (d) => fs.writeFileSync("users.json", JSON.stringify(d, null, 2));

// ================= USERS =================
function addUser(user) {
  let users = loadUsers();
  if (!users.find(u => u.id === user.id)) {
    users.push({
      id: user.id,
      username: user.username || "",
      first_name: user.first_name || ""
    });
    saveUsers(users);
  }
}

// ================= JOIN CHECK =================
async function isJoined(ctx) {
  try {
    const m = await ctx.telegram.getChatMember(CHANNEL, ctx.from.id);
    return ["member", "administrator", "creator"].includes(m.status);
  } catch {
    return false;
  }
}

// ================= START =================
bot.start(async (ctx) => {
  addUser(ctx.from);

  if (!(await isJoined(ctx))) {
    return ctx.reply(
      "📢 Kanalga obuna bo‘ling",
      Markup.inlineKeyboard([
        [Markup.button.url("📢 Kanal", `https://t.me/${CHANNEL.replace("@", "")}`)],
        [Markup.button.callback("✅ Tekshirish", "check_sub")]
      ])
    );
  }

  ctx.reply("🎬 Xush kelibsiz! Kino kodini yuboring.");
});

// ================= CHECK SUB =================
bot.action("check_sub", async (ctx) => {
  const ok = await isJoined(ctx);
  await ctx.answerCbQuery(ok ? "✅ Tasdiqlandi" : "❌ Obuna bo‘ling");

  if (ok) ctx.reply("🎬 Endi kino kodini yuboring.");
});

// ================= ADMIN LOGIN =================
bot.hears(ADMIN_PASSWORD, (ctx) => {
  adminMode[ctx.from.id] = true;

  ctx.reply(
    "🔐 Admin panel",
    Markup.keyboard([
      ["➕ Kino qo‘shish", "❌ Kino o‘chirish"],
      ["📊 Statistika", "👥 Userlar"],
      ["🚪 Chiqish"]
    ]).resize()
  );
});

// ================= MAIN TEXT HANDLER =================
bot.on("text", async (ctx) => {
  addUser(ctx.from);

  const id = ctx.from.id;
  const text = ctx.message.text.trim();
  const movies = loadMovies();

  if (text === ADMIN_PASSWORD) return;

  // ===== EXIT ADMIN =====
  if (text === "🚪 Chiqish") {
    delete adminMode[id];
    delete addMovie[id];
    delete deleteMode[id];
    return ctx.reply("❌ Admin paneldan chiqildi", Markup.removeKeyboard());
  }

  // ===== STAT =====
  if (text === "📊 Statistika") {
    if (!adminMode[id]) return;
    return ctx.reply(`📦 Kinolar: ${Object.keys(movies).length}\n👥 Userlar: ${loadUsers().length}`);
  }

  // ===== USERS =====
  if (text === "👥 Userlar") {
    if (!adminMode[id]) return;

    const txt = loadUsers()
      .map(u => `• ${u.username || u.first_name || u.id}`)
      .join("\n") || "User yo‘q";

    return ctx.reply(txt);
  }

  // ===== DELETE MODE =====
  if (deleteMode[id]) {
    if (movies[text]) {
      delete movies[text];
      saveMovies(movies);
      delete deleteMode[id];
      return ctx.reply(`✅ ${text} kino o‘chirildi`);
    }

    delete deleteMode[id];
    return ctx.reply("❌ Bunday kino topilmadi");
  }

  // ===== ADD MOVIE FLOW =====
  if (addMovie[id]) {
    if (addMovie[id].step === "code") {
      addMovie[id].code = text;
      addMovie[id].step = "name";
      return ctx.reply("📝 Kino nomini yuboring");
    }

    if (addMovie[id].step === "name") {
      addMovie[id].name = text;
      addMovie[id].step = "video";
      return ctx.reply("📹 Endi videoni yuboring");
    }

    return;
  }

  // ===== USER GET MOVIE =====
  if (!adminMode[id] && movies[text]) {
    return ctx.replyWithVideo(movies[text].fileId, {
      caption: `🎬 ${movies[text].name}\n\n🍿 Maroqli tomosha!`
    });
  }

  if (!adminMode[id]) {
    return ctx.reply("❌ Bu kod bo‘yicha kino topilmadi.");
  }
});

// ================= VIDEO SAVE =================
bot.on("video", (ctx) => {
  const id = ctx.from.id;

  if (!addMovie[id] || addMovie[id].step !== "video") return;

  const movies = loadMovies();

  movies[addMovie[id].code] = {
    name: addMovie[id].name,
    fileId: ctx.message.video.file_id
  };

  saveMovies(movies);

  delete addMovie[id];

  ctx.reply("✅ Kino qo‘shildi!");
});

// ================= EXPRESS =================
const app = express();
app.get("/", (req, res) => res.send("Bot is running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on " + PORT));

// ================= START BOT =================
bot.launch();
console.log("Bot started");