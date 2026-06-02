
require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const express = require("express");
const fs = require("fs");

const bot = new Telegraf(process.env.BOT_TOKEN);

const CHANNEL = "@kinolar_uzb1l";
const ADMIN_PASSWORD = "HPR";

let adminMode = {};
let addMovie = {};
let deleteMode = {};

function ensure(file, def) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(def, null, 2));
  }
}

ensure("movies.json", {});
ensure("users.json", []);

const loadMovies = () =>
  JSON.parse(fs.readFileSync("movies.json"));

const saveMovies = (data) =>
  fs.writeFileSync("movies.json", JSON.stringify(data, null, 2));

const loadUsers = () =>
  JSON.parse(fs.readFileSync("users.json"));

const saveUsers = (data) =>
  fs.writeFileSync("users.json", JSON.stringify(data, null, 2));

function addUser(user) {
  let users = loadUsers();

  if (!users.find((u) => u.id === user.id)) {
    users.push({
      id: user.id,
      username: user.username || "",
      first_name: user.first_name || "",
    });

    saveUsers(users);
  }
}

async function isJoined(ctx) {
  try {
    const member = await ctx.telegram.getChatMember(
      CHANNEL,
      ctx.from.id
    );

    return [
      "member",
      "administrator",
      "creator",
    ].includes(member.status);
  } catch {
    return false;
  }
}

bot.start(async (ctx) => {
  addUser(ctx.from);

  const username = ctx.from.username
    ? `@${ctx.from.username}`
    : ctx.from.first_name;

  if (!(await isJoined(ctx))) {
    return ctx.reply(
      `👋 Assalomu alaykum, ${username}!\n\n📢 Kanalga obuna bo‘ling`,
      Markup.inlineKeyboard([
        [
          Markup.button.url(
            "📢 Kanal",
            `https://t.me/${CHANNEL.replace("@", "")}`
          ),
        ],
        [
          Markup.button.callback(
            "✅ Tekshirish",
            "check_sub"
          ),
        ],
      ])
    );
  }

  ctx.reply(
    `👋 Assalomu alaykum, ${username}!\n\n🎬 Kino kodini yuboring.`
  );
});

bot.action("check_sub", async (ctx) => {
  const ok = await isJoined(ctx);

  await ctx.answerCbQuery(
    ok ? "✅ Tasdiqlandi" : "❌ Obuna bo‘ling"
  );

  if (ok) {
    ctx.reply("🎬 Endi kino kodini yuboring.");
  }
});

bot.hears(ADMIN_PASSWORD, (ctx) => {
  adminMode[ctx.from.id] = true;

  ctx.reply(
    "🔐 Admin panel",
    Markup.keyboard([
      ["➕ Kino qo‘shish", "❌ Kino o‘chirish"],
      ["📊 Statistika", "👥 Userlar"],
      ["🚪 Chiqish"],
    ]).resize()
  );
});

bot.on("text", async (ctx) => {
  addUser(ctx.from);

  const id = ctx.from.id;
  const text = ctx.message.text.trim();

  if (text === ADMIN_PASSWORD) return;

  if (text === "🚪 Chiqish" && adminMode[id]) {
    delete adminMode[id];
    delete addMovie[id];
    delete deleteMode[id];

    return ctx.reply(
      "❌ Admin paneldan chiqildi",
      Markup.removeKeyboard()
    );
  }

  if (text === "📊 Statistika" && adminMode[id]) {
    return ctx.reply(
      `📦 Kinolar: ${
        Object.keys(loadMovies()).length
      }\n👥 Userlar: ${loadUsers().length}`
    );
  }

  if (text === "👥 Userlar" && adminMode[id]) {
    const users = loadUsers();

    const txt =
      users
        .map(
          (u) =>
            `• ${u.username || u.first_name || u.id}`
        )
        .join("\n") || "User yo‘q";

    return ctx.reply(txt);
  }

  if (text === "➕ Kino qo‘shish" && adminMode[id]) {
    addMovie[id] = {
      step: "code",
    };

    return ctx.reply("🎬 Kino kodini yuboring");
  }

  if (text === "❌ Kino o‘chirish" && adminMode[id]) {
    deleteMode[id] = true;

    return ctx.reply("🗑 Kino kodini yuboring");
  }

  const movies = loadMovies();

  if (deleteMode[id]) {
    if (movies[text]) {
      delete movies[text];

      saveMovies(movies);

      delete deleteMode[id];

      return ctx.reply(
        `✅ ${text} kodli kino o‘chirildi`
      );
    }

    delete deleteMode[id];

    return ctx.reply(
      "❌ Bunday kodli kino topilmadi"
    );
  }

  if (addMovie[id]) {
    if (addMovie[id].step === "code") {
      addMovie[id].code = text;
      addMovie[id].step = "name";

      return ctx.reply(
        "📝 Kino nomini yuboring"
      );
    }

    if (addMovie[id].step === "name") {
      addMovie[id].name = text;
      addMovie[id].step = "video";

      return ctx.reply(
        "📹 Endi videoni yuboring"
      );
    }
  }

  if (movies[text]) {
    return ctx.replyWithVideo(
      movies[text].fileId,
      {
        caption: `🎬 ${movies[text].name}\n\n🍿 Maroqli tomosha tilaymiz!`,
      }
    );
  }

  return ctx.reply(
    "❌ Bu kod bo‘yicha kino topilmadi."
  );
});

bot.on("video", (ctx) => {
  const id = ctx.from.id;

  if (
    !addMovie[id] ||
    addMovie[id].step !== "video"
  ) {
    return;
  }

  const movies = loadMovies();

  movies[addMovie[id].code] = {
    name: addMovie[id].name,
    fileId: ctx.message.video.file_id,
  };

  saveMovies(movies);

  delete addMovie[id];

  ctx.reply("✅ Kino muvaffaqiyatli qo‘shildi!");
});

bot.catch((err) => {
  console.log("BOT ERROR:", err);
});

bot.launch();
console.log("Bot started");

const app = express();

app.get("/", (req, res) => {
  res.send("Bot is running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    "Server running on port " + PORT
  );
});

