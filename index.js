require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");

const bot = new Telegraf(process.env.BOT_TOKEN);
const CHANNEL = "@kinolar_uzb1l";
const ADMIN_PASSWORD = "HPR";

let adminMode = {};
let addMovie = {};
let deleteMode = {};

function ensure(file, def){
 if(!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(def,null,2));
}
ensure("movies.json", {});
ensure("users.json", []);

const loadMovies=()=>JSON.parse(fs.readFileSync("movies.json"));
const saveMovies=(d)=>fs.writeFileSync("movies.json", JSON.stringify(d,null,2));
const loadUsers=()=>JSON.parse(fs.readFileSync("users.json"));
const saveUsers=(d)=>fs.writeFileSync("users.json", JSON.stringify(d,null,2));

function addUser(user){
 let users=loadUsers();
 if(!users.find(u=>u.id===user.id)){
   users.push({id:user.id, username:user.username||"", first_name:user.first_name||""});
   saveUsers(users);
 }
}

async function isJoined(ctx){
 try{
  const m=await ctx.telegram.getChatMember(CHANNEL, ctx.from.id);
  return ["member","administrator","creator"].includes(m.status);
 }catch(e){ return false; }
}

bot.start(async(ctx)=>{
 addUser(ctx.from);
 if(!(await isJoined(ctx))){
  return ctx.reply("📢 Kanalga obuna bo‘ling", Markup.inlineKeyboard([
   [Markup.button.url("📢 Kanal",`https://t.me/${CHANNEL.replace("@","")}`)],
   [Markup.button.callback("✅ Tekshirish","check_sub")]
  ]));
 }
 ctx.reply("🎬 Xush kelibsiz! Kino kodini yuboring.");
});

bot.action("check_sub", async(ctx)=>{
 const ok=await isJoined(ctx);
 await ctx.answerCbQuery(ok?"✅ Tasdiqlandi":"❌ Obuna bo‘ling");
 if(ok) ctx.reply("🎬 Endi kino kodini yuboring.");
});

bot.hears(ADMIN_PASSWORD,(ctx)=>{
 adminMode[ctx.from.id]=true;
 ctx.reply("🔐 Admin panel", Markup.keyboard([
  ["➕ Kino qo‘shish","❌ Kino o‘chirish"],
  ["📊 Statistika","👥 Userlar"],
  ["🚪 Chiqish"]
 ]).resize());
});

bot.hears("🚪 Chiqish",(ctx)=>{
 delete adminMode[ctx.from.id];
 ctx.reply("❌ Admin paneldan chiqildi", Markup.removeKeyboard());
});

bot.hears("📊 Statistika",(ctx)=>{
 if(!adminMode[ctx.from.id]) return;
 ctx.reply(`📦 Kinolar: ${Object.keys(loadMovies()).length}\n👥 Userlar: ${loadUsers().length}`);
});

bot.hears("👥 Userlar",(ctx)=>{
 if(!adminMode[ctx.from.id]) return;
 const txt=loadUsers().map(u=>`• ${u.username||u.first_name||u.id}`).join("\n") || "User yo‘q";
 ctx.reply(txt);
});

bot.hears("➕ Kino qo‘shish",(ctx)=>{
 if(!adminMode[ctx.from.id]) return;
 addMovie[ctx.from.id]={step:"code"};
 ctx.reply("🎬 Kino kodini yuboring");
});

bot.hears("❌ Kino o‘chirish",(ctx)=>{
 if(!adminMode[ctx.from.id]) return;
 deleteMode[ctx.from.id]=true;
 ctx.reply("🗑 Kino kodini yuboring");
});

bot.on("text",(ctx)=>{
 addUser(ctx.from);
 const id=ctx.from.id;
 const text=ctx.message.text;
 const movies=loadMovies();

 if(text===ADMIN_PASSWORD) return;

 if(deleteMode[id]){
   if(movies[text]){
     delete movies[text];
     saveMovies(movies);
     delete deleteMode[id];
     return ctx.reply("✅ Kino o‘chirildi");
   }
   delete deleteMode[id];
   return ctx.reply("❌ Bunday kod topilmadi");
 }

 if(addMovie[id]){
   if(addMovie[id].step==="code"){
     addMovie[id].code=text;
     addMovie[id].step="name";
     return ctx.reply("📝 Kino nomini yuboring");
   }
   if(addMovie[id].step==="name"){
     addMovie[id].name=text;
     addMovie[id].step="video";
     return ctx.reply("📹 Endi videoni yuboring");
   }
   if(addMovie[id].step==="video"){
     return ctx.reply("📹 Iltimos video yuboring");
   }
 }

 if(movies[text]){
   return ctx.replyWithVideo(movies[text].fileId,{
    caption:`🎬 ${movies[text].name}\n\n🍿 Maroqli tomosha tilaymiz!`
   });
 }

 ctx.reply("❌ Bu kod bo‘yicha kino topilmadi.");
});

bot.on("video",(ctx)=>{
 const id=ctx.from.id;
 if(!addMovie[id] || addMovie[id].step!=="video") return;

 const movies=loadMovies();
 movies[addMovie[id].code]={
   name:addMovie[id].name,
   fileId:ctx.message.video.file_id
 };
 saveMovies(movies);

 delete addMovie[id];
 ctx.reply("✅ Kino muvaffaqiyatli qo‘shildi!");
});

bot.launch().then(()=>console.log("Bot started"));
