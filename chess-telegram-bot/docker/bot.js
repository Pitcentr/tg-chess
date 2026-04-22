import { Bot, InlineKeyboard, InputFile } from "grammy";
import { Chess } from "chess.js";
import PocketBase from "pocketbase";
import dotenv from "dotenv";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import { existsSync } from "fs";

// Register system font for coordinate labels
const FONT_PATHS = [
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
];
for (const p of FONT_PATHS) {
  if (existsSync(p)) { GlobalFonts.registerFromPath(p, "DejaVu"); break; }
}
const LABEL_FONT = "bold 18px DejaVu, sans-serif";

// ── Шахматные факты ──────────────────────────────────────────────────────────
const CHESS_FACTS = [
  "Шахматы возникли в Индии около 1500 лет назад — первая известная игра называлась чатуранга и символизировала четыре рода войск.",
  "Слово «шахмат» пришло из персидского «шах мат» — «король мёртв».",
  "Число возможных шахматных партий превышает количество атомов во Вселенной — это число называют числом Шеннона (10¹²⁰).",
  "Самая длинная теоретически возможная шахматная партия составляет 5 949 ходов.",
  "Первый шахматный компьютер Deep Blue победил чемпиона мира Гарри Каспарова в 1997 году — это был исторический перелом.",
  "Ходом конём можно обойти всю доску, побывав на каждой из 64 клеток ровно по одному разу — эта задача называется «тур коня».",
  "Слово «гамбит» вошло в повседневный язык из шахмат — изначально оно означало жертву пешки ради позиционного преимущества.",
  "В начальной позиции белые могут сделать 20 разных ходов, и столько же — чёрные в ответ.",
  "Самая быстрая победа в шахматах — «мат в 2 хода» (дурацкий мат), доступный уже с первых ходов.",
  "Шахматная доска имеет 64 клетки, но число уникальных позиций на ней превышает 10⁴³.",
  "Гарри Каспаров в 1985 году стал самым молодым чемпионом мира — ему было всего 22 года.",
  "Сергей Карякин в 2002 году получил звание гроссмейстера в 12 лет и 7 месяцев — на тот момент самый молодой в истории.",
  "Шахматная фигура ферзь была слабой в ранних версиях игры и могла ходить лишь на одну клетку по диагонали — её усилили в XV веке.",
  "В СССР шахматы были государственным видом спорта и преподавались в школах как обязательная дисциплина.",
  "Магнус Карлсен достиг рейтинга 2882 по системе Эло — абсолютный рекорд в истории шахмат.",
  "Каждый год 600 миллионов человек играют в шахматы по всему миру.",
  "Шахматные часы были изобретены в 1883 году — до этого игроки могли думать над ходом бесконечно долго.",
  "В Иране после исламской революции 1979 года шахматы временно запретили как «западную игру», однако вскоре легализовали вновь.",
  "Компьютер Stockfish настолько силён, что играет против себя и всё равно находит улучшения в собственной игре.",
  "Первый шахматный турнир был проведён в Лондоне в 1851 году — его выиграл немецкий маэстро Адольф Андерсен.",
  "«Бессмертная партия» 1851 года между Андерсеном и Кизерицким считается красивейшей в истории — белые пожертвовали почти все фигуры ради мата.",
  "Ферзь является самой мощной фигурой и стоит примерно 9 пешек по стандартной оценке.",
  "Примерно 1 из 1 000 000 шахматных партий завершается патом — редчайшим исходом, при котором проигрывающий спасается ничьей.",
  "Шахматный термин «цугцванг» (обязанность ходить себе во вред) заимствован из немецкого и широко используется в стратегии и политике.",
  "В NASA шахматы входили в список психологических тренировок для астронавтов как способ поддержания остроты ума.",
  "Роберт Джеймс Фишер в 1971–1972 годах провёл 20 партий подряд без единого поражения на пути к титулу чемпиона мира.",
  "На шахматной доске 18 ферзей могут стоять одновременно, не угрожая друг другу — это классическая математическая задача.",
  "Первый шахматный автомат «Турок» (1770) восхищал публику 84 года — оказалось, внутри прятался живой гроссмейстер.",
  "Слово «ладья» в русском языке означает лодку — эта фигура в старых индийских шахматах изображала боевую колесницу.",
  "По статистике, 95% шахматных партий на любительском уровне решаются тактическими ошибками, а не стратегическим превосходством.",
  "Число возможных комбинаций после первых 4 ходов каждой стороны составляет более 288 миллиардов.",
  "Слово «шах» в персидском означает «король» — именно поэтому правителей Ирана исторически называли шахами.",
  "Великий математик Леонард Эйлер серьёзно изучал задачу тура коня и написал о ней научную работу в 1759 году.",
  "В среднестатистической шахматной партии делается около 40 ходов, хотя рекорд официальной партии — 269 ходов (Николич — Арсович, 1989).",
  "Вильгельм Стейниц стал первым официальным чемпионом мира по шахматам в 1886 году — именно тогда появился сам титул.",
  "Шахматный движок AlphaZero от DeepMind обучился игре с нуля за 4 часа и разгромил Stockfish со счётом 28–0 в 2017 году.",
  "Пешка, дошедшая до последней горизонтали, может превратиться в любую фигуру, кроме короля — теоретически на доске может быть 9 ферзей.",
  "Хосе Рауль Капабланка с 1916 по 1924 год не проиграл ни одной партии в турнирах — серия из 407 партий без поражений.",
  "Шахматы включены в программу Азиатских игр с 2006 года как официальный вид спорта.",
  "Термин «энпассан» (взятие на проходе) — единственный ход в шахматах, при котором фигура берёт клетку, на которой нет противника.",
  "Бобби Фишер в детстве самостоятельно выучил русский язык, чтобы читать советские шахматные книги в оригинале.",
  "Самый молодой гроссмейстер в истории на сегодняшний день — индиец Абхиманью Мишра, получивший титул в 12 лет и 4 месяца в 2021 году.",
  "В стандартной позиции конь на е5 атакует 8 клеток — это максимально возможное число для коня.",
  "Шахматный термин «вилка» означает одновременную атаку двух фигур одним конём — одна из самых неприятных тактик.",
  "Советский Союз доминировал в шахматах с 1948 по 1972 год — все чемпионы мира в этот период были гражданами СССР, кроме Фишера.",
  "Анатолий Карпов в 1975 году получил титул чемпиона мира без единой сыгранной партии — Фишер отказался от матча.",
  "На шахматной доске существует ровно 400 различных позиций после первого хода каждой стороны.",
  "Слон в шахматах всю партию остаётся на клетках одного цвета — именно поэтому два слона дополняют друг друга.",
  "Гарри Каспаров в 1985–2005 годах занимал первое место в мировом рейтинге почти непрерывно 20 лет.",
  "Ход «рокировка» появился в шахматных правилах лишь в XV–XVI веках — в древних шахматах его не существовало.",
  "Компьютеры полностью «решили» шашки в 2007 году, но шахматы до сих пор не решены из-за астрономического числа позиций.",
  "В Исландии шахматы являются обязательным предметом в начальной школе с 1973 года.",
  "Знаменитая «Опера-партия» 1858 года сыграна Полом Морфи прямо в ложе оперного театра против двух противников, не отрываясь от спектакля.",
  "Международная шахматная федерация ФИДЕ основана в 1924 году в Париже и сегодня объединяет более 190 стран.",
  "Визуальная память чемпионов настолько развита, что они способны восстановить позицию из любой известной партии после беглого взгляда на доску.",
  "Рекорд одновременной игры — гроссмейстер сыграл против 604 противников одновременно и выиграл большинство партий.",
  "Пешка — единственная фигура, которая не может ходить назад, что делает каждое пешечное продвижение необратимым решением.",
  "Слово «мат» в арабском языке («мата») означает «он умер» — шахматная терминология сохранила этот смысл спустя тысячу лет.",
  "Вильгельм Стейниц в старости утверждал, что играл в шахматы с Богом по телефону и давал ему фору в пешку — и выиграл.",
  "Исследования показывают, что регулярная игра в шахматы снижает риск болезни Альцгеймера на 35% и значительно замедляет возрастное снижение когнитивных функций."
];

function getRandomChessFact() {
  return CHESS_FACTS[Math.floor(Math.random() * CHESS_FACTS.length)];
}

dotenv.config();

const REQUIRED_ENV = ['TG_TOKEN', 'PB_URL', 'PB_ADMIN', 'PB_PASSWORD'];

function log(level, message, data = null) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${level}] ${message}`);
  if (data) console.dir(data, { depth: null });
}

// ── Piece SVGs — Staunty set, viewBox 0 0 50 50 ─────────────────────────────
const PIECE_SVG = {
  "b": `<g transform="translate(-492.21 -571.21)"><g transform="matrix(1 0 0 1.0191 0 10.367)" stroke-width=".99059"><path d="m-492.23-571.94c-1.1552 1.7e-4 -2.0917 0.97405-2.0918 2.1754 1.7e-4 0.49597 0.16328 0.97698 0.46228 1.3634-14.841 13.636-6.1941 25.207-6.1941 25.207h15.647s6.8687-9.1922-2.1471-20.846c-2.5961 3.1775-3.4916 8.5165-3.4916 8.5165l-3.1471-0.78469s1.4217-6.9942 4.3231-10.4c-0.5391-0.56029-1.113-1.1245-1.7314-1.6927 0.29902-0.38637 0.46212-0.86738 0.46229-1.3634-1.3e-4 -1.2014-0.93657-2.1752-2.0918-2.1754z" fill="#474545" stroke="#050505" stroke-opacity=".99975" stroke-width=".89153"/><path d="m-492.23-571.94c1.6359 2.2011 0.42137 2.4454 0.13088 3.4011 0 0 1.2531 1.629 1.3974 1.8303-2.9014 3.4057-2.9616 11.185-2.9616 11.185s0.59992-3.5675 2.2366-6.6058c0.66363-1.6623 1.5132-3.3528 2.5576-4.5788-0.53908-0.56028-1.113-1.1245-1.7314-1.6927 0.29904-0.38636 0.46214-0.86737 0.46229-1.3633-1.3e-4 -1.2014-0.93654-2.1753-2.0918-2.1755zm5.6764 7.8995c-0.68261 0.83548-0.26433-0.14969-0.72641 0.84831 6.0199 10.283-0.74467 19.998-0.74467 19.998h3.6182s6.8687-9.1922-2.1471-20.846z" opacity=".4"/></g><path d="m-501.61-543.19c-3.8003 2.0594-4.1456 2.9933-4.1456 7.1295 9.0173 0.15151 18.034 0.0594 27.051 0 0.10437-4.1586 0.3424-5.2041-4.1471-7.1295z" fill="#474545" stroke="#050505" stroke-linejoin="round" stroke-opacity=".99975" stroke-width=".8"/><path d="m-486.75-543.19c4.4895 1.9255 4.2511 2.971 4.1468 7.1296 0 0 1.0025-2e-3 3.9026 0 0.10439-4.1587 0.34228-5.2042-4.1472-7.1296z" opacity=".4"/></g>`,
  "k": `<g transform="translate(-423.52 -537.04)"><g transform="matrix(.93617 0 0 .99867 -71.422 -44.505)" stroke-width="1.0342"><g><path d="m-373.15-518.91v-3.0978h4.3602v-5.061h-4.9069v-3.9841h-4.824v3.9841h-4.9069v5.061h4.3602v3.0978" fill="#474545" stroke="#050505" stroke-opacity=".99975" stroke-width=".82738"/><path d="m-368.26-499.35s8.6559-13.629 7.3706-16.286c-1.2853-2.657-10.009-3.5265-15.212-3.5265-5.2032 0-13.927 0.86896-15.212 3.5265-1.2853 2.6572 7.3706 16.286 7.3706 16.286z" fill="#474545" stroke="#050505" stroke-opacity=".99975" stroke-width=".82738"/><path d="m-376.1-519.17c-0.65679 0-1.3697 0.0139-2.1167 0.0434 5.1704 0.20455 11.972 1.1613 13.095 3.483 1.2853 2.6572-7.3706 16.286-7.3706 16.286h4.2333s8.6559-13.629 7.3706-16.286c-1.2853-2.657-10.009-3.5264-15.212-3.5264z" opacity=".4"/></g><path d="m-391.43-515.24c10.122-1.3995 20.348-1.2444 30.647 0" fill="none" stroke="#050505" stroke-width=".82738"/></g><g transform="matrix(.8741 0 0 1.0764 -132.09 -3.152)" stroke-width="1.0309"><path d="m-344.13-501.7c-4.3476 1.9131-4.7427 2.7807-4.7427 6.6233 10.316 0.14075 20.631 0.0552 30.947 0 0.1194-3.8634 0.39172-4.8345-4.7444-6.6233z" fill="#474545" stroke="#050505" stroke-linejoin="round" stroke-opacity=".99975" stroke-width=".82474"/><path d="m-327.13-501.7c5.1362 1.7887 4.8634 2.76 4.744 6.6234 0 0 1.1469-2e-3 4.4647 0 0.11942-3.8634 0.39158-4.8346-4.7446-6.6234z" opacity=".4"/></g></g>`,
  "n": `<g transform="translate(-527.58 -531.54)"><g><path d="m-518.01-543.19s9.6693-20.661-11.368-28.968l0.15071 2.68s-3.8506 0.0879-4.2507 0.84563c-0.51083 0.58427-1.2488 4.7832-8.4748 8.9252l-0.0368 2.6895 0.8827 0.98729 1.8075-0.95046 0.74313 0.9464-1.4599 0.91424 1.2327 1.3074 1.87-0.62625 0.78166-1.7734 6.818-1.4244c0.51261 5.5356-7.0987 9.6405-7.0987 9.6405l1.0063 4.8064z" fill="#474545" stroke="#050505" stroke-opacity=".99975" stroke-width=".8"/><path d="m-529.33-569.48c1.6378 0.0679 3.8959-1.2063 5.79-1.8079 0.40899 1.5613 0.20395 2.454-1.047 4.205" fill="#474545" stroke="#050505" stroke-linecap="round" stroke-opacity=".99975" stroke-width=".8"/><path d="m-540.45-559.08s0.28117 0.71966 0.5061 0.6597c0.22493-0.06 0.86223-1.1395 0.58107-1.1795-0.28117-0.04-1.0872 0.51977-1.0872 0.51977z" fill="#050505" stroke="#000" stroke-width=".26458px"/></g><g fill="none" stroke="#050505" stroke-linecap="round" stroke-width=".6"><path d="m-522.39-568.16-1.4661 4.6665"/><path d="m-521.09-567-1.7982 5.8894"/><path d="m-518.54-563.84-1.2634 4.0371"/><path d="m-519.73-565.5-2.032 6.7322"/></g><path d="m-524.13-568.99c11.232 9.607 2.8804 25.908 1.8919 25.792h4.2333s7.4378-17.022-6.1253-25.792z" opacity=".4"/><ellipse cx="-531.2" cy="-564.78" rx=".52229" ry=".56983" fill="#050505" style="paint-order:normal"/><ellipse cx="-530.91" cy="-564.87" rx=".94128" ry=".99138" fill="none" stroke="#050505" stroke-linecap="round" stroke-linejoin="round" stroke-width=".6" style="paint-order:normal"/><path d="m-532.68-564.6s0.9817-1.5375 3.4448-1.6248" fill="none" stroke="#050505" stroke-linecap="round" stroke-width=".8"/><g transform="matrix(.8741 0 0 1.0764 -235.28 -3.152)" stroke-width="1.0309"><path d="m-344.13-501.7c-4.3476 1.9131-4.7427 2.7807-4.7427 6.6233 10.316 0.14075 20.631 0.0552 30.947 0 0.1194-3.8634 0.39172-4.8345-4.7444-6.6233z" fill="#474545" stroke="#050505" stroke-linejoin="round" stroke-opacity=".99975" stroke-width=".82474"/><path d="m-327.13-501.7c5.1362 1.7887 4.8634 2.76 4.744 6.6234 0 0 1.1469-2e-3 4.4647 0 0.11942-3.8634 0.39158-4.8346-4.7446-6.6234z" opacity=".4"/></g></g>`,
  "p": `<g transform="translate(-597.03 -541.21)"><g transform="matrix(1.0012 0 0 1.0011 -295.3 -40.357)" stroke-width=".99882"><g transform="matrix(1.0748 0 0 1.1202 -137.22 -285.45)" stroke-width=".91029"><g transform="matrix(1.1628 0 0 1.1144 -404.11 -63.069)" stroke-width=".79965"><ellipse cx="216.28" cy="-132.25" rx="4.478" ry="4.1616" fill="#474545" stroke="#050505" stroke-linecap="round" stroke-linejoin="round" stroke-opacity=".99975" stroke-width=".63972" style="paint-order:normal"/></g><path d="m-155.39-203.87h5.2909m-4.6257-2.5408c-0.0105 4e-3 -0.0159 8e-3 -0.0258 0.0115h-1.5647l-2.2756 1.2647s8e-3 1.0366 2.2756 1.2647h0.92538c0 9.8532-4.7364 10.322-4.7364 10.322h14.773s-4.7453-0.46883-4.7453-10.322h1.2006c2.2673-0.2281 2.2755-1.2647 2.2755-1.2647l-2.2755-1.2647h-3.7087z" fill="#474545" stroke="#050505" stroke-linejoin="round" stroke-opacity=".99975" stroke-width=".72823"/></g><path d="m-301.13-525.89a5.5963 5.1955 0 0 0-1.3203 0.15346 5.5963 5.1955 0 0 1 4.2711 5.0421 5.5963 5.1955 0 0 1-2.8784 4.5346h1.2681l2.4453 1.417s-9e-3 1.1614-2.4453 1.417h-1.2904c0 11.038 5.1 11.563 5.1 11.563h2.6458s-5.0999-0.52512-5.0999-11.563h1.2904c2.4368-0.25554 2.4453-1.417 2.4453-1.417l-2.4453-1.417h-1.2681a5.5963 5.1955 0 0 0 2.8784-4.5346 5.5963 5.1955 0 0 0-5.5966-5.1956z" opacity=".4" style="paint-order:normal"/></g><g transform="matrix(.74048 0 0 1.0658 -350.17 -8.5136)" stroke-width="1.1257"><path d="m-344.14-501.7c-4.3502 1.9131-4.7454 2.7807-4.7454 6.6233 10.322 0.14075 20.643 0.0552 30.965 0 0.11947-3.8634 0.39195-4.8345-4.7472-6.6233z" fill="#474545" stroke="#050505" stroke-linejoin="round" stroke-opacity=".99975" stroke-width=".90054"/><path d="m-327.13-501.7c5.1362 1.7887 4.8634 2.76 4.744 6.6234 0 0 1.1469-2e-3 4.4647 0 0.11942-3.8634 0.39158-4.8346-4.7446-6.6234z" opacity=".4"/></g></g>`,
  "q": `<g transform="translate(-457.68 -561.17)"><g transform="matrix(.97618 0 0 .96254 -10.904 -20.347)" stroke-width="1.0316"><ellipse cx="-457.77" cy="-571.98" rx="2.8281" ry="2.5959" fill="#474545" stroke="#050505" stroke-linecap="round" stroke-linejoin="round" stroke-opacity=".99975" stroke-width=".82531" style="paint-order:normal"/><path d="m-459.74-569.5c-6.7178 2.7415-8.5154 10.177-8.5154 10.177h20.977s-1.7979-7.4374-8.5173-10.178z" fill="#474545" stroke="#050505" stroke-linecap="round" stroke-linejoin="round" stroke-opacity=".99975" stroke-width=".82531"/><path d="m-457.91-574.57s0.40838-0.28764-7e-5 1e-5c1.2526 1.112 2.5318 2.987 0.6574 5.0685 6.7194 2.7408 7.1005 10.178 7.1005 10.178h2.7522s-1.7977-7.4373-8.5171-10.178c2.4469-3.5017-0.20918-4.9544-1.9929-5.0682z" opacity=".4"/><path d="m-457.77-567.8s-1.5983 4.322-3.5958 4.8244c-1.6706 0.44667-4.5037-3.4453-4.5037-3.4453s-0.10501 0.81874-0.36957 1.7723c-0.3176 1.1447-0.86513 2.4836-1.737 2.8339-1.1624 0.47455-4.6632-2.2856-4.6632-2.2856 3.7573 7.8443 7.3803 15.786 7.5363 20.902h15.169c0.15606-5.1162 3.276-13.058 7.0332-20.902 0 0-3.5008 2.7601-4.6632 2.2856-1.5981-0.64207-2.1066-4.6062-2.1066-4.6062s-2.8331 3.892-4.5038 3.4453c-1.9976-0.50245-3.5958-4.8244-3.5958-4.8244z" fill="#474545" stroke="#050505" stroke-linecap="round" stroke-linejoin="round" stroke-opacity=".99975" stroke-width=".82531"/><path d="m-442.94-564.09s1.3932-0.0413 0 0c-7.5491 6.9932-10.103 16.294-10.244 20.902h3.2108c0.15605-5.1162 3.2758-13.058 7.0331-20.902z" opacity=".4"/></g><g transform="matrix(.8741 0 0 1.0764 -166.34 -3.152)" stroke-width="1.0309"><path d="m-344.13-501.7c-4.3476 1.9131-4.7427 2.7807-4.7427 6.6233 10.316 0.14075 20.631 0.0552 30.947 0 0.1194-3.8634 0.39172-4.8345-4.7444-6.6233z" fill="#474545" stroke="#050505" stroke-linejoin="round" stroke-opacity=".99975" stroke-width=".82474"/><path d="m-327.13-501.7c5.1362 1.7887 4.8634 2.76 4.744 6.6234 0 0 1.1469-2e-3 4.4647 0 0.11942-3.8634 0.39158-4.8346-4.7446-6.6234z" opacity=".4"/></g></g>`,
  "r": `<g transform="translate(-564.09 -531.54)"><g transform="matrix(.92451 0 0 .91158 -106.45 -89.307)" stroke-width="1.0893"><path d="m-501.92-517.15h13.615m-17.457-2.3261h21.3m-20.356 21.56 2.8985-19.234-3.8427-2.3261v-7.7402h4.2963v3.6797h3.8122v-3.3626h5.083v3.3626h3.8122v-3.6797h4.2963v7.7402l-3.8427 2.3261 2.8985 19.234z" fill="#474545" stroke="#050505" stroke-opacity=".99975" stroke-width=".87144"/><path d="m-487.11-527.22v7.7401l-3.8426 2.326 1.8402 19.234h3.7042l-2.8985-19.234 3.8426-2.326v-7.7401z" opacity=".4"/></g><g transform="matrix(.8741 0 0 1.0764 -272.69 -3.152)" stroke-width="1.0309"><path d="m-344.13-501.7c-4.3476 1.9131-4.7427 2.7807-4.7427 6.6233 10.316 0.14075 20.631 0.0552 30.947 0 0.1194-3.8634 0.39172-4.8345-4.7444-6.6233z" fill="#474545" stroke="#050505" stroke-linejoin="round" stroke-opacity=".99975" stroke-width=".82474"/><path d="m-327.13-501.7c5.1362 1.7887 4.8634 2.76 4.744 6.6234 0 0 1.1469-2e-3 4.4647 0 0.11942-3.8634 0.39158-4.8346-4.7446-6.6234z" opacity=".4"/></g></g>`,
  "B": `<g transform="translate(-492.21 -571.21)"><g transform="matrix(1 0 0 1.0191 0 10.367)" stroke-width=".99059"><path d="m-492.23-571.94c-1.1552 1.7e-4 -2.0917 0.97405-2.0918 2.1754 1.7e-4 0.49597 0.16328 0.97698 0.46228 1.3634-14.841 13.636-6.1941 25.207-6.1941 25.207h15.647s6.8687-9.1922-2.1471-20.846c-2.5961 3.1775-3.4916 8.5165-3.4916 8.5165l-3.1471-0.78469s1.4217-6.9942 4.3231-10.4c-0.5391-0.56029-1.113-1.1245-1.7314-1.6927 0.29902-0.38637 0.46212-0.86738 0.46229-1.3634-1.3e-4 -1.2014-0.93657-2.1752-2.0918-2.1754z" fill="#f5e9da" stroke="#282828" stroke-opacity=".99964" stroke-width=".89153"/><path d="m-492.23-571.94c1.6359 2.2011 0.42137 2.4454 0.13088 3.4011 0 0 1.2531 1.629 1.3974 1.8303-2.9014 3.4057-2.9616 11.185-2.9616 11.185s0.59992-3.5675 2.2366-6.6058c0.66363-1.6623 1.5132-3.3528 2.5576-4.5788-0.53908-0.56028-1.113-1.1245-1.7314-1.6927 0.29904-0.38636 0.46214-0.86737 0.46229-1.3633-1.3e-4 -1.2014-0.93654-2.1753-2.0918-2.1755zm5.6764 7.8995c-0.68261 0.83548-0.26433-0.14969-0.72641 0.84831 6.0199 10.283-0.74467 19.998-0.74467 19.998h3.6182s6.8687-9.1922-2.1471-20.846z" opacity=".4"/></g><path d="m-501.61-543.19c-3.8003 2.0594-4.1456 2.9933-4.1456 7.1295 9.0173 0.15151 18.034 0.0594 27.051 0 0.10437-4.1586 0.3424-5.2041-4.1471-7.1295z" fill="#f5e9da" stroke="#282828" stroke-linejoin="round" stroke-opacity=".99964" stroke-width=".8"/><path d="m-486.75-543.19c4.4895 1.9255 4.2511 2.971 4.1468 7.1296 0 0 1.0025-2e-3 3.9026 0 0.10439-4.1587 0.34228-5.2042-4.1472-7.1296z" opacity=".4"/></g>`,
  "K": `<g transform="translate(-423.52 -537.04)"><g transform="matrix(.93617 0 0 .99867 -71.422 -44.505)" stroke-width="1.0342"><g><path d="m-373.15-518.91v-3.0978h4.3602v-5.061h-4.9069v-3.9841h-4.824v3.9841h-4.9069v5.061h4.3602v3.0978" fill="#f5e9da" stroke="#282828" stroke-width=".82738"/><path d="m-368.26-499.35s8.6559-13.629 7.3706-16.286c-1.2853-2.657-10.009-3.5265-15.212-3.5265-5.2032 0-13.927 0.86896-15.212 3.5265-1.2853 2.6572 7.3706 16.286 7.3706 16.286z" fill="#f5e9da" stroke="#282828" stroke-width=".82738"/><path d="m-376.1-519.17c-0.65679 0-1.3697 0.0139-2.1167 0.0434 5.1704 0.20455 11.972 1.1613 13.095 3.483 1.2853 2.6572-7.3706 16.286-7.3706 16.286h4.2333s8.6559-13.629 7.3706-16.286c-1.2853-2.657-10.009-3.5264-15.212-3.5264z" opacity=".4"/></g><path d="m-391.43-515.24c10.122-1.3995 20.348-1.2444 30.647 0" fill="none" stroke="#282828" stroke-width=".82738"/></g><g transform="matrix(.8741 0 0 1.0764 -132.09 -3.152)" stroke-width="1.0309"><path d="m-344.13-501.7c-4.3476 1.9131-4.7427 2.7807-4.7427 6.6233 10.316 0.14075 20.631 0.0552 30.947 0 0.1194-3.8634 0.39172-4.8345-4.7444-6.6233z" fill="#f5e9da" stroke="#282828" stroke-linejoin="round" stroke-width=".82474"/><path d="m-327.13-501.7c5.1362 1.7887 4.8634 2.76 4.744 6.6234 0 0 1.1469-2e-3 4.4647 0 0.11942-3.8634 0.39158-4.8346-4.7446-6.6234z" opacity=".4"/></g></g>`,
  "N": `<g transform="translate(-527.58 -531.54)"><g><path d="m-518.01-543.19s9.6693-20.661-11.368-28.968l0.15071 2.68s-3.8506 0.0879-4.2507 0.84563c-0.51083 0.58427-1.2488 4.7832-8.4748 8.9252l-0.0368 2.6895 0.8827 0.98729 1.8075-0.95046 0.74313 0.9464-1.4599 0.91424 1.2327 1.3074 1.87-0.62625 0.78166-1.7734 6.818-1.4244c0.51261 5.5356-7.0987 9.6405-7.0987 9.6405l1.0063 4.8064z" fill="#f5e9da" stroke="#282828" stroke-opacity=".99964" stroke-width=".8"/><path d="m-529.33-569.48c1.6378 0.0679 3.8959-1.2063 5.79-1.8079 0.40899 1.5613 0.20395 2.454-1.047 4.205" fill="#f5e9da" stroke="#3c3c3c" stroke-linecap="round" stroke-width=".8"/><path d="m-540.45-559.08s0.28117 0.71966 0.5061 0.6597c0.22493-0.06 0.86223-1.1395 0.58107-1.1795-0.28117-0.04-1.0872 0.51977-1.0872 0.51977z" fill="#282828" stroke="#282828" stroke-width=".26458px"/></g><g fill="none" stroke="#282828" stroke-linecap="round" stroke-width=".6"><path d="m-522.39-568.16-1.4661 4.6665"/><path d="m-521.09-567-1.7982 5.8894"/><path d="m-518.54-563.84-1.2634 4.0371"/><path d="m-519.73-565.5-2.032 6.7322"/></g><path d="m-524.13-568.99c11.232 9.607 2.8804 25.908 1.8919 25.792h4.2333s7.4378-17.022-6.1253-25.792z" opacity=".4"/><ellipse cx="-531.2" cy="-564.78" rx=".52229" ry=".56983" fill="#282828" style="paint-order:normal"/><ellipse cx="-530.91" cy="-564.87" rx=".94128" ry=".99138" fill="none" stroke="#282828" stroke-linecap="round" stroke-linejoin="round" stroke-width=".6" style="paint-order:normal"/><path d="m-532.68-564.6s0.9817-1.5375 3.4448-1.6248" fill="none" stroke="#282828" stroke-linecap="round" stroke-width=".8"/><g transform="matrix(.8741 0 0 1.0764 -235.28 -3.152)" stroke-width="1.0309"><path d="m-344.13-501.7c-4.3476 1.9131-4.7427 2.7807-4.7427 6.6233 10.316 0.14075 20.631 0.0552 30.947 0 0.1194-3.8634 0.39172-4.8345-4.7444-6.6233z" fill="#f5e9da" stroke="#282828" stroke-linejoin="round" stroke-opacity=".99964" stroke-width=".82474"/><path d="m-327.13-501.7c5.1362 1.7887 4.8634 2.76 4.744 6.6234 0 0 1.1469-2e-3 4.4647 0 0.11942-3.8634 0.39158-4.8346-4.7446-6.6234z" opacity=".4"/></g></g>`,
  "P": `<g transform="translate(-597.03 -541.21)"><g transform="matrix(1.0012 0 0 1.0011 -295.3 -40.357)" stroke-width=".99882"><g transform="matrix(1.0748 0 0 1.1202 -137.22 -285.45)" stroke-width=".91029"><g transform="matrix(1.1628 0 0 1.1144 -404.11 -63.069)" stroke-width=".79965"><ellipse cx="216.28" cy="-132.25" rx="4.478" ry="4.1616" fill="#f5e9da" stroke="#282828" stroke-linecap="round" stroke-linejoin="round" stroke-opacity=".99964" stroke-width=".63972" style="paint-order:normal"/></g><path d="m-155.39-203.87h5.2909m-4.6257-2.5408c-0.0105 4e-3 -0.0159 8e-3 -0.0258 0.0115h-1.5647l-2.2756 1.2647s8e-3 1.0366 2.2756 1.2647h0.92538c0 9.8532-4.7364 10.322-4.7364 10.322h14.773s-4.7453-0.46883-4.7453-10.322h1.2006c2.2673-0.2281 2.2755-1.2647 2.2755-1.2647l-2.2755-1.2647h-3.7087z" fill="#f5e9da" stroke="#282828" stroke-linejoin="round" stroke-opacity=".99964" stroke-width=".72823"/></g><path d="m-301.13-525.89a5.5963 5.1955 0 0 0-1.3203 0.15346 5.5963 5.1955 0 0 1 4.2711 5.0421 5.5963 5.1955 0 0 1-2.8784 4.5346h1.2681l2.4453 1.417s-9e-3 1.1614-2.4453 1.417h-1.2904c0 11.038 5.1 11.563 5.1 11.563h2.6458s-5.0999-0.52512-5.0999-11.563h1.2904c2.4368-0.25554 2.4453-1.417 2.4453-1.417l-2.4453-1.417h-1.2681a5.5963 5.1955 0 0 0 2.8784-4.5346 5.5963 5.1955 0 0 0-5.5966-5.1956z" opacity=".4" style="paint-order:normal"/></g><g transform="matrix(.74048 0 0 1.0658 -350.17 -8.5136)" stroke-width="1.1257"><path d="m-344.14-501.7c-4.3502 1.9131-4.7454 2.7807-4.7454 6.6233 10.322 0.14075 20.643 0.0552 30.965 0 0.11947-3.8634 0.39195-4.8345-4.7472-6.6233z" fill="#f5e9da" stroke="#282828" stroke-linejoin="round" stroke-opacity=".99964" stroke-width=".90054"/><path d="m-327.13-501.7c5.1362 1.7887 4.8634 2.76 4.744 6.6234 0 0 1.1469-2e-3 4.4647 0 0.11942-3.8634 0.39158-4.8346-4.7446-6.6234z" opacity=".4"/></g></g>`,
  "Q": `<g transform="translate(-457.68 -561.17)"><g transform="matrix(.97618 0 0 .96254 -10.904 -20.347)" stroke-width="1.0316"><ellipse cx="-457.77" cy="-571.98" rx="2.8281" ry="2.5959" fill="#f5e9da" stroke="#282828" stroke-linecap="round" stroke-linejoin="round" stroke-opacity=".99964" stroke-width=".82531" style="paint-order:normal"/><path d="m-459.74-569.5c-6.7178 2.7415-8.5154 10.177-8.5154 10.177h20.977s-1.7979-7.4374-8.5173-10.178z" fill="#f5e9da" stroke="#282828" stroke-linecap="round" stroke-linejoin="round" stroke-opacity=".99964" stroke-width=".82531"/><path d="m-457.91-574.57s0.40838-0.28764-7e-5 1e-5c1.2526 1.112 2.5318 2.987 0.6574 5.0685 6.7194 2.7408 7.1005 10.178 7.1005 10.178h2.7522s-1.7977-7.4373-8.5171-10.178c2.4469-3.5017-0.20918-4.9544-1.9929-5.0682z" opacity=".4"/><path d="m-457.77-567.8s-1.5983 4.322-3.5958 4.8244c-1.6706 0.44667-4.5037-3.4453-4.5037-3.4453s-0.10501 0.81874-0.36957 1.7723c-0.3176 1.1447-0.86513 2.4836-1.737 2.8339-1.1624 0.47455-4.6632-2.2856-4.6632-2.2856 3.7573 7.8443 7.3803 15.786 7.5363 20.902h15.169c0.15606-5.1162 3.276-13.058 7.0332-20.902 0 0-3.5008 2.7601-4.6632 2.2856-1.5981-0.64207-2.1066-4.6062-2.1066-4.6062s-2.8331 3.892-4.5038 3.4453c-1.9976-0.50245-3.5958-4.8244-3.5958-4.8244z" fill="#f5e9da" stroke="#282828" stroke-linecap="round" stroke-linejoin="round" stroke-opacity=".99964" stroke-width=".82531"/><path d="m-442.94-564.09s1.3932-0.0413 0 0c-7.5491 6.9932-10.103 16.294-10.244 20.902h3.2108c0.15605-5.1162 3.2758-13.058 7.0331-20.902z" opacity=".4"/></g><g transform="matrix(.8741 0 0 1.0764 -166.34 -3.152)" stroke-width="1.0309"><path d="m-344.13-501.7c-4.3476 1.9131-4.7427 2.7807-4.7427 6.6233 10.316 0.14075 20.631 0.0552 30.947 0 0.1194-3.8634 0.39172-4.8345-4.7444-6.6233z" fill="#f5e9da" stroke="#282828" stroke-linejoin="round" stroke-opacity=".99964" stroke-width=".82474"/><path d="m-327.13-501.7c5.1362 1.7887 4.8634 2.76 4.744 6.6234 0 0 1.1469-2e-3 4.4647 0 0.11942-3.8634 0.39158-4.8346-4.7446-6.6234z" opacity=".4"/></g></g>`,
  "R": `<g transform="translate(-564.09 -531.54)"><g transform="matrix(.92451 0 0 .91158 -106.45 -89.307)" stroke-width="1.0893"><path d="m-501.92-517.15h13.615m-17.457-2.3261h21.3m-20.356 21.56 2.8985-19.234-3.8427-2.3261v-7.7402h4.2963v3.6797h3.8122v-3.3626h5.083v3.3626h3.8122v-3.6797h4.2963v7.7402l-3.8427 2.3261 2.8985 19.234z" fill="#f5e9da" stroke="#282828" stroke-opacity=".99964" stroke-width=".87144"/><path d="m-487.11-527.22v7.7401l-3.8426 2.326 1.8402 19.234h3.7042l-2.8985-19.234 3.8426-2.326v-7.7401z" opacity=".4"/></g><g transform="matrix(.8741 0 0 1.0764 -272.69 -3.152)" stroke-width="1.0309"><path d="m-344.13-501.7c-4.3476 1.9131-4.7427 2.7807-4.7427 6.6233 10.316 0.14075 20.631 0.0552 30.947 0 0.1194-3.8634 0.39172-4.8345-4.7444-6.6233z" fill="#f5e9da" stroke="#282828" stroke-linejoin="round" stroke-opacity=".99964" stroke-width=".82474"/><path d="m-327.13-501.7c5.1362 1.7887 4.8634 2.76 4.744 6.6234 0 0 1.1469-2e-3 4.4647 0 0.11942-3.8634 0.39158-4.8346-4.7446-6.6234z" opacity=".4"/></g></g>`,
};

// Cache rendered piece images (built once on first use)
const pieceImageCache = {};
async function getPieceImage(piece) {
  if (pieceImageCache[piece]) return pieceImageCache[piece];
  const inner = PIECE_SVG[piece];
  if (!inner) return null;
  // Render SVG at 2× native size (90×90) for crisp pieces
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="90" height="90">${inner}</svg>`;
  const img = await loadImage(Buffer.from(svg));
  pieceImageCache[piece] = img;
  return img;
}

const LIGHT  = "#F0D9B5";
const DARK   = "#B58863";
const BORDER = "#2b2b2b";
const SQ     = 90;   // square size in px (2× = retina-ready)
const PAD    = 36;   // padding for coordinate labels
const SIZE   = SQ * 8 + PAD * 2;

async function renderBoard(fen, perspective = "white") {
  const canvas  = createCanvas(SIZE, SIZE);
  const ctx     = canvas.getContext("2d");
  const flipped = perspective === "black";

  // Border background
  ctx.fillStyle = BORDER;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Parse FEN position
  const position = fen.split(" ")[0];
  const board = position.split("/").map(row => {
    const cells = [];
    for (const ch of row) {
      if (/\d/.test(ch)) for (let i = 0; i < +ch; i++) cells.push(null);
      else cells.push(ch);
    }
    return cells;
  });

  // Draw squares
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const dr = flipped ? 7 - r : r;
      const df = flipped ? 7 - f : f;
      ctx.fillStyle = (r + f) % 2 === 0 ? LIGHT : DARK;
      ctx.fillRect(PAD + df * SQ, PAD + dr * SQ, SQ, SQ);
    }
  }

  // ── Coordinate labels in the PAD border ──────────────────────────────────
  const files = flipped ? "hgfedcba" : "abcdefgh";
  ctx.font         = LABEL_FONT;
  ctx.textBaseline = "middle";
  ctx.textAlign    = "center";
  ctx.fillStyle    = "#d0d0d0";

  // Rank numbers — left and right PAD strips
  for (let r = 0; r < 8; r++) {
    const rank = String(flipped ? r + 1 : 8 - r);
    const y    = PAD + r * SQ + SQ / 2;
    ctx.fillText(rank, PAD / 2, y);
    ctx.fillText(rank, SIZE - PAD / 2, y);
  }

  // File letters — top and bottom PAD strips
  for (let f = 0; f < 8; f++) {
    const x = PAD + f * SQ + SQ / 2;
    ctx.fillText(files[f], x, PAD / 2);
    ctx.fillText(files[f], x, SIZE - PAD / 2);
  }

  // Draw pieces (SVG already at 90×90, drawn 1:1)
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f];
      if (!piece) continue;
      const dr  = flipped ? 7 - r : r;
      const df  = flipped ? 7 - f : f;
      const img = await getPieceImage(piece);
      if (img) ctx.drawImage(img, PAD + df * SQ, PAD + dr * SQ, SQ, SQ);
    }
  }

  return canvas.toBuffer("image/png");
}

// chess.js v0.13 API
function gameStatusText(chess) {
  if (chess.in_checkmate()) return "♟ Шах и мат!";
  if (chess.in_stalemate()) return "🤝 Пат — ничья!";
  if (chess.in_draw())      return "🤝 Ничья!";
  if (chess.in_check())     return "⚠️ Шах!";
  return null;
}

function looksLikeMove(text) {
  const t = text.trim().toLowerCase();
  if (t === "o-o-o" || t === "0-0-0") return true;
  if (t === "o-o"   || t === "0-0")   return true;
  if (/^[a-h]\d-?[a-h]\d[qrbn]?$/.test(t)) return true;
  if (/^[NBRQK][a-h]?[1-8]?x?[a-h][1-8][+#]?$/.test(text.trim())) return true;
  if (/^[a-h]x?[a-h]?[1-8][+#]?$/.test(t)) return true;
  return false;
}

// ── Init ─────────────────────────────────────────────────────────────────────
// bot and pb are initialized inside main() after env validation
let bot;
const pb = new PocketBase(process.env.PB_URL || "http://localhost:8090");

// ── DeepSeek position evaluation ─────────────────────────────────────────────
async function evaluatePosition(fen, whiteName, blackName) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const prompt =
    `You are a chess grandmaster. Analyze this chess position (FEN notation) and estimate winning chances.\n\n` +
    `FEN: ${fen}\n\n` +
    `Players: White = ${whiteName}, Black = ${blackName}\n\n` +
    `Respond ONLY in this exact JSON format, no other text:\n` +
    `{"white": <0-100>, "black": <0-100>, "draw": <0-100>, "comment": "<one short sentence in Russian>"}\n\n` +
    `The three numbers must sum to 100. Be realistic based on material and position.`;

  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 120,
        temperature: 0.2,
      }),
    });

    if (!res.ok) { log('WARN', `DeepSeek API error: ${res.status}`); return null; }

    const data  = await res.json();
    const text  = data.choices?.[0]?.message?.content?.trim() || "";
    // Extract JSON even if wrapped in markdown code block
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const eval_ = JSON.parse(match[0]);
    return eval_;
  } catch (err) {
    log('WARN', `DeepSeek eval failed: ${err.message}`);
    return null;
  }
}

function formatEval(eval_, whiteName, blackName) {
  if (!eval_) return "";
  const wBar = "█".repeat(Math.round(eval_.white / 10));
  const bBar = "█".repeat(Math.round(eval_.black / 10));
  return (
    `\n\n📊 <b>Оценка позиции:</b>\n` +
    `⬜ ${whiteName}: <b>${eval_.white}%</b> ${wBar}\n` +
    `⬛ ${blackName}: <b>${eval_.black}%</b> ${bBar}\n` +
    (eval_.draw > 5 ? `🤝 Ничья: <b>${eval_.draw}%</b>\n` : "") +
    (eval_.comment ? `💡 ${eval_.comment}` : "")
  );
}

async function main() {
  const missing = REQUIRED_ENV.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error('⚠️ ОТСУТСТВУЮТ ПЕРЕМЕННЫЕ:', missing.join(', '));
    while (true) await new Promise(r => setTimeout(r, 60000));
  }

  log('INFO', 'Запуск Chess Bot');

  // ── PocketBase auth ───────────────────────────────────────────────────────
  // Always re-authenticate — don't trust authStore.isValid, it can lie
  async function ensurePBAuth() {
    try {
      await pb.collection("_superusers").authWithPassword(
        process.env.PB_ADMIN, process.env.PB_PASSWORD
      );
    } catch (err) {
      log('ERROR', 'PB auth failed', err.message);
      throw err;
    }
  }

  // Wrap any PB call with auto-retry on 401/403
  async function pbCall(fn) {
    try {
      return await fn();
    } catch (err) {
      if (err?.status === 401 || err?.status === 403) {
        log('WARN', `PB auth error (${err.status}), re-authenticating...`);
        await ensurePBAuth();
        return await fn(); // retry once
      }
      throw err;
    }
  }

  await ensurePBAuth();
  log('INFO', 'Успешная аутентификация в PocketBase');

  // Proactive token refresh every 20 minutes (PB tokens expire in ~1h)
  setInterval(async () => {
    try {
      await ensurePBAuth();
      log('INFO', 'PB token refreshed (scheduled)');
    } catch (err) {
      log('ERROR', 'Scheduled PB token refresh failed', err.message);
    }
  }, 20 * 60 * 1000);

  await ensureCollections();

  async function getOrCreateUser(telegramId, username, firstName) {
    const id = String(telegramId);
    try {
      return await pbCall(() =>
        pb.collection("chess_users").getFirstListItem(`telegram_id="${id}"`, { requestKey: null })
      );
    } catch (err) {
      if (err?.status !== 404) {
        log('ERROR', `getOrCreateUser lookup failed for ${id}`, err.message);
        throw err;
      }
      try {
        return await pbCall(() =>
          pb.collection("chess_users").create(
            { telegram_id: id, username: username || "", first_name: firstName || "" },
            { requestKey: null }
          )
        );
      } catch (createErr) {
        log('ERROR', `Failed to create user ${id}`, createErr.message);
        throw createErr;
      }
    }
  }

  async function getActiveGame(userId) {
    try {
      return await pbCall(() =>
        pb.collection("chess_games").getFirstListItem(
          `(player_white="${userId}" || player_black="${userId}") && (status="active" || status="waiting")`,
          { requestKey: null }
        )
      );
    } catch (err) {
      if (err?.status !== 404) log('ERROR', `getActiveGame failed for ${userId}`, err.message);
      return null;
    }
  }

  async function getGameById(id) {
    try {
      return await pbCall(() =>
        pb.collection("chess_games").getOne(id, { requestKey: null })
      );
    } catch (err) {
      if (err?.status !== 404) log('ERROR', `getGameById failed for ${id}`, err.message);
      return null;
    }
  }

  async function getPlayerName(userId) {
    try {
      const u = await pbCall(() =>
        pb.collection("chess_users").getFirstListItem(`telegram_id="${userId}"`, { requestKey: null })
      );
      return u.username ? `@${u.username}` : (u.first_name || `User ${userId}`);
    } catch (err) {
      if (err?.status !== 404) log('ERROR', `getPlayerName failed for ${userId}`, err.message);
      return `User ${userId}`;
    }
  }

  async function processMove(ctx, userId, moveStr) {
    log('INFO', `MOVE from ${userId}: ${moveStr}`);
    const game = await getActiveGame(userId);
    if (!game)                    return ctx.reply("❌ У вас нет активной игры. Создайте: /newgame");
    if (game.status !== "active") return ctx.reply("❌ Игра ещё не началась. Ждите соперника.");

    const isWhite = game.player_white === userId;
    const myColor = isWhite ? "white" : "black";
    if (game.turn !== myColor) return ctx.reply("⏳ Сейчас не ваш ход.");

    const chess      = new Chess(game.fen);
    const normalized = moveStr.replace(/-/g, "").toLowerCase();
    let result = null;
    try {
      if (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(normalized)) {
        result = chess.move({ from: normalized.slice(0,2), to: normalized.slice(2,4), promotion: normalized[4] || "q" });
      } else {
        result = chess.move(moveStr.trim());
      }
    } catch { result = null; }

    if (!result) {
      return ctx.reply(`❌ Недопустимый ход: <code>${moveStr}</code>\n\nПример: <code>e2e4</code>`, { parse_mode: "HTML" });
    }

    const newFen    = chess.fen();
    const newTurn   = chess.turn() === "w" ? "white" : "black";
    const statusTxt = gameStatusText(chess);
    const isOver    = chess.game_over();
    const newStatus = isOver ? "finished" : "active";
    const winner    = isOver && chess.in_checkmate() ? userId : "";
    const newMoveCount = (game.move_count || 0) + 1;

    try {
      await pbCall(() =>
        pb.collection("chess_moves").create(
          { game_id: game.id, player_id: userId, move: moveStr, fen_after: newFen },
          { requestKey: null }
        )
      );
      await pbCall(() =>
        pb.collection("chess_games").update(game.id,
          { fen: newFen, turn: newTurn, status: newStatus, winner, move_count: newMoveCount },
          { requestKey: null }
        )
      );
    } catch (err) {
      log('ERROR', `Failed to save move for game ${game.id}`, err.message);
      return ctx.reply("❌ Ошибка сохранения хода. Попробуйте ещё раз.");
    }

    const whiteName  = await getPlayerName(game.player_white);
    const blackName  = await getPlayerName(game.player_black);
    const moverName  = isWhite ? whiteName : blackName;
    const opponentId = isWhite ? game.player_black : game.player_white;
    const oppColor   = isWhite ? "black" : "white";
    const moveInfo   = `✅ Ход: <code>${result.san}</code> (${moverName})`;

    // Вывод факта о шахматах каждые 3 хода
    let factText = "";
    if (newMoveCount % 3 === 0 && !isOver) {
      factText = `\n\n💡 <b>Факт о шахматах:</b>\n<i>${getRandomChessFact()}</i>`;
    }

    const myCaption = moveInfo + (statusTxt ? `\n\n${statusTxt}` : "\n\n⏳ Ждём хода соперника...") + factText;

    const myBoard = await renderBoard(newFen, myColor);
    await ctx.replyWithPhoto(new InputFile(myBoard, "board.png"), { caption: myCaption, parse_mode: "HTML" });

    if (opponentId) {
      const oppStatus = isOver
        ? (chess.in_checkmate() ? `\n\n♟ Шах и мат! Победили ${moverName}!` : `\n\n🤝 ${statusTxt}`)
        : (chess.in_check() ? "\n\n⚠️ Шах! Ваш ход." : "\n\n🎯 Ваш ход!");
      try {
        const oppBoard = await renderBoard(newFen, oppColor);
        await bot.api.sendPhoto(opponentId, new InputFile(oppBoard, "board.png"), {
          caption: moveInfo + oppStatus + factText, parse_mode: "HTML",
        });
      } catch {}
    }

    if (isOver) {
      const endMsg = chess.in_checkmate() ? `🏆 Победитель: ${moverName}!` : `🤝 ${statusTxt}`;
      await ctx.reply(endMsg);
      if (opponentId) try { await bot.api.sendMessage(opponentId, endMsg); } catch {}
    }
  }

  async function doJoinGame(ctx, gameId, userId) {
    const game = await getGameById(gameId);
    if (!game)                        return ctx.reply("❌ Игра не найдена.");
    if (game.status !== "waiting")    return ctx.reply("❌ Игра уже началась или завершена.");
    if (game.player_white === userId) return ctx.reply("❌ Нельзя играть с собой.");

    try {
      await pbCall(() =>
        pb.collection("chess_games").update(gameId, { player_black: userId, status: "active" }, { requestKey: null })
      );
    } catch (err) {
      log('ERROR', `Failed to join game ${gameId}`, err.message);
      return ctx.reply("❌ Ошибка присоединения к игре. Попробуйте ещё раз.");
    }
    const updated   = await getGameById(gameId);
    const whiteName = await getPlayerName(updated.player_white);
    const blackName = await getPlayerName(updated.player_black);

    try {
      const whiteBoard = await renderBoard(updated.fen, "white");
      await bot.api.sendPhoto(updated.player_white, new InputFile(whiteBoard, "board.png"), {
        caption: `🎉 <b>${blackName}</b> присоединился!\n\nВы ходите первыми ⬜\n\n🎯 Ваш ход!`,
        parse_mode: "HTML",
      });
    } catch {}

    const blackBoard = await renderBoard(updated.fen, "black");
    await ctx.replyWithPhoto(new InputFile(blackBoard, "board.png"), {
      caption: `♟ <b>Игра началась!</b>\n⬜ ${whiteName}  vs  ⬛ ${blackName}\n\n⏳ Ждите хода белых...\n💡 Пишите ход прямо в чат: <code>e7e5</code>`,
      parse_mode: "HTML",
    });
  }

  // ── Commands ────────────────────────────────────────────────────────────────
  bot.command("start", async (ctx) => {
    log('INFO', `CMD /start from ${ctx.from.id}`);
    await getOrCreateUser(ctx.from.id, ctx.from.username, ctx.from.first_name);
    await ctx.reply(
      `♟ <b>Chess Bot</b>\n\nИграйте в шахматы прямо в Telegram!\n\n<b>Команды:</b>\n` +
      `/newgame — создать новую игру\n/join &lt;ID&gt; — присоединиться к игре\n` +
      `/move e2e4 — сделать ход\n/board — показать текущую доску\n` +
      `/resign — сдаться\n/games — список открытых игр\n\n` +
      `💡 Во время игры пишите ход прямо в чат: <code>e2e4</code>\n` +
      `💬 Любой другой текст пересылается сопернику\n` +
      `/eval — оценка позиции от AI`,
      { parse_mode: "HTML" }
    );
  });

  bot.command("newgame", async (ctx) => {
    log('INFO', `CMD /newgame from ${ctx.from.id}`);
    await getOrCreateUser(ctx.from.id, ctx.from.username, ctx.from.first_name);
    const existing = await getActiveGame(String(ctx.from.id));
    if (existing) {
      return ctx.reply(`⚠️ У вас уже есть активная игра (ID: <code>${existing.id}</code>).\nСначала завершите её: /resign`, { parse_mode: "HTML" });
    }
    const chess = new Chess();
    let game;
    try {
      await ensurePBAuth();
      game = await pbCall(() =>
        pb.collection("chess_games").create(
          { player_white: String(ctx.from.id), player_black: "", status: "waiting", fen: chess.fen(), turn: "white", winner: "" },
          { requestKey: null }
        )
      );
    } catch (err) {
      log('ERROR', `Failed to create game for ${ctx.from.id}`, err.message);
      return ctx.reply("❌ Ошибка создания игры. Попробуйте ещё раз.");
    }
    const kb = new InlineKeyboard().text("✅ Присоединиться", `join_${game.id}`);
    await ctx.reply(
      `♟ <b>Новая игра создана!</b>\n\nВы играете белыми ⬜\n\nID игры: <code>${game.id}</code>\n\n` +
      `Отправьте другу: <code>/join ${game.id}</code>\n\nИли пусть нажмёт кнопку 👇`,
      { parse_mode: "HTML", reply_markup: kb }
    );
  });

  bot.command("join", async (ctx) => {
    log('INFO', `CMD /join from ${ctx.from.id}`);
    await getOrCreateUser(ctx.from.id, ctx.from.username, ctx.from.first_name);
    const gameId = ctx.match?.trim();
    if (!gameId) {
      try {
        await ensurePBAuth();
        const res = await pbCall(() =>
          pb.collection("chess_games").getList(1, 10, { filter: 'status="waiting"', requestKey: null })
        );
        if (res.items.length === 0) return ctx.reply("📭 Нет открытых игр. Создайте свою: /newgame");
        const kb = new InlineKeyboard();
        for (const g of res.items) kb.text(`⬜ ${await getPlayerName(g.player_white)} ищет соперника`, `join_${g.id}`).row();
        return ctx.reply("🎮 Открытые игры:", { reply_markup: kb });
      } catch (err) {
        log('ERROR', `Failed to list games`, err.message);
        return ctx.reply("❌ Ошибка загрузки списка игр.");
      }
    }
    await doJoinGame(ctx, gameId, String(ctx.from.id));
  });

  bot.command("move", async (ctx) => {
    const moveStr = ctx.match?.trim();
    if (!moveStr) return ctx.reply("❌ Укажите ход. Пример: /move e2e4");
    await processMove(ctx, String(ctx.from.id), moveStr);
  });

  bot.command("board", async (ctx) => {
    log('INFO', `CMD /board from ${ctx.from.id}`);
    const userId = String(ctx.from.id);
    const game   = await getActiveGame(userId);
    if (!game) return ctx.reply("❌ У вас нет активной игры.");
    const chess     = new Chess(game.fen);
    const isWhite   = game.player_white === userId;
    const whiteName = await getPlayerName(game.player_white);
    const blackName = game.player_black ? await getPlayerName(game.player_black) : "ожидание...";
    const turnName  = game.turn === "white" ? whiteName : blackName;
    const statusTxt = gameStatusText(chess);
    const caption   = `♟ <b>Текущая позиция</b>\n⬜ ${whiteName}  vs  ⬛ ${blackName}\n\n` +
      (statusTxt ? statusTxt : `🎯 Ход: ${turnName} (${game.turn === "white" ? "⬜" : "⬛"})`);
    const board = await renderBoard(game.fen, isWhite ? "white" : "black");
    await ctx.replyWithPhoto(new InputFile(board, "board.png"), { caption, parse_mode: "HTML" });
  });

  bot.command("resign", async (ctx) => {
    log('INFO', `CMD /resign from ${ctx.from.id}`);
    const userId = String(ctx.from.id);
    const game   = await getActiveGame(userId);
    if (!game) return ctx.reply("❌ У вас нет активной игры.");
    const isWhite    = game.player_white === userId;
    const opponentId = isWhite ? game.player_black : game.player_white;
    try {
      await pbCall(() =>
        pb.collection("chess_games").update(game.id, { status: "finished", winner: opponentId || "" }, { requestKey: null })
      );
    } catch (err) {
      log('ERROR', `Failed to resign game ${game.id}`, err.message);
      return ctx.reply("❌ Ошибка завершения игры. Попробуйте ещё раз.");
    }
    const myName = await getPlayerName(userId);
    await ctx.reply(`🏳 ${myName} сдался. Игра завершена.`);
    if (opponentId) {
      const oppName = await getPlayerName(opponentId);
      try { await bot.api.sendMessage(opponentId, `🏆 ${myName} сдался! Вы победили, ${oppName}!`); } catch {}
    }
  });

  bot.command("games", async (ctx) => {
    try {
      const res = await pbCall(() =>
        pb.collection("chess_games").getList(1, 10, { filter: 'status="waiting"', requestKey: null })
      );
      if (res.items.length === 0) return ctx.reply("📭 Нет открытых игр. Создайте свою: /newgame");
      const kb = new InlineKeyboard();
      for (const g of res.items) kb.text(`⬜ ${await getPlayerName(g.player_white)} ищет соперника`, `join_${g.id}`).row();
      await ctx.reply(`🎮 Открытые игры (${res.items.length}):`, { reply_markup: kb });
    } catch (err) {
      log('ERROR', `Failed to list games`, err.message);
      return ctx.reply("❌ Ошибка загрузки списка игр.");
    }
  });

  bot.command("eval", async (ctx) => {
    log('INFO', `CMD /eval from ${ctx.from.id}`);
    if (!process.env.DEEPSEEK_API_KEY) {
      return ctx.reply("❌ DeepSeek API не настроен. Укажите DEEPSEEK_API_KEY.");
    }
    const userId = String(ctx.from.id);
    const game   = await getActiveGame(userId);
    if (!game)                    return ctx.reply("❌ У вас нет активной игры.");
    if (game.status !== "active") return ctx.reply("❌ Игра ещё не началась.");

    const thinking = await ctx.reply("🤖 Анализирую позицию...");
    const whiteName = await getPlayerName(game.player_white);
    const blackName = await getPlayerName(game.player_black);
    const eval_     = await evaluatePosition(game.fen, whiteName, blackName);

    const text = eval_
      ? `🤖 <b>Оценка AI</b>\n` + formatEval(eval_, whiteName, blackName).trim()
      : "❌ Не удалось получить оценку. Попробуйте позже.";

    try { await bot.api.deleteMessage(ctx.chat.id, thinking.message_id); } catch {}
    await ctx.reply(text, { parse_mode: "HTML" });
  });

  bot.callbackQuery(/^join_(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await getOrCreateUser(ctx.from.id, ctx.from.username, ctx.from.first_name);
    await doJoinGame(ctx, ctx.match[1], String(ctx.from.id));
  });

  bot.callbackQuery(/^board_(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const game = await getGameById(ctx.match[1]);
    if (!game) return ctx.reply("❌ Игра не найдена.");
    const userId    = String(ctx.from.id);
    const isWhite   = game.player_white === userId;
    const chess     = new Chess(game.fen);
    const whiteName = await getPlayerName(game.player_white);
    const blackName = game.player_black ? await getPlayerName(game.player_black) : "ожидание...";
    const statusTxt = gameStatusText(chess);
    const turnName  = game.turn === "white" ? whiteName : blackName;
    const caption   = `♟ <b>Доска</b>\n⬜ ${whiteName}  vs  ⬛ ${blackName}\n\n` +
      (statusTxt ? statusTxt : `🎯 Ход: ${turnName}`);
    const board = await renderBoard(game.fen, isWhite ? "white" : "black");
    await ctx.replyWithPhoto(new InputFile(board, "board.png"), { caption, parse_mode: "HTML" });
  });

  bot.on("message:text", async (ctx) => {
    const text   = ctx.message.text.trim();
    const userId = String(ctx.from.id);
    log('INFO', `MSG from ${userId}: "${text.slice(0, 40)}"`);
    if (text.startsWith("/")) return;
    const game = await getActiveGame(userId);
    if (!game || game.status !== "active") return;
    const isWhite    = game.player_white === userId;
    const opponentId = isWhite ? game.player_black : game.player_white;
    if (looksLikeMove(text)) return processMove(ctx, userId, text);
    if (opponentId) {
      const myName = await getPlayerName(userId);
      try {
        await bot.api.sendMessage(opponentId, `💬 <b>${myName}:</b> ${text}`, { parse_mode: "HTML" });
        await ctx.reply("✉️ Отправлено сопернику");
      } catch { await ctx.reply("❌ Не удалось отправить сообщение сопернику."); }
    }
  });

  bot.catch((err) => {
    log('ERROR', `Handler error: ${err.message}`);
    if (err.stack) log('ERROR', 'Stack trace:', err.stack);
    if (err.error) log('ERROR', 'Error details:', err.error);
    try { err.ctx.reply("❌ Внутренняя ошибка.").catch(() => {}); } catch {}
  });

  log('INFO', 'Устанавливаем команды бота...');
  try {
    await bot.api.setMyCommands([
      { command: "start",   description: "Главное меню" },
      { command: "newgame", description: "Создать новую игру" },
      { command: "join",    description: "Присоединиться к игре" },
      { command: "move",    description: "Сделать ход (напр. e2e4)" },
      { command: "board",   description: "Показать текущую доску" },
      { command: "eval",    description: "Оценка позиции AI (DeepSeek)" },
      { command: "resign",  description: "Сдаться" },
      { command: "games",   description: "Список открытых игр" },
    ]);
    log('INFO', 'Команды установлены');
  } catch (err) { log('ERROR', 'Ошибка setMyCommands', err.message); }

  log('INFO', 'Удаляем вебхук...');
  try {
    await bot.api.deleteWebhook({ drop_pending_updates: false });
    log('INFO', 'Вебхук удалён');
  } catch (err) { log('WARN', 'deleteWebhook error', err.message); }

  log('INFO', 'Запускаем polling...');
  await bot.start();
}

async function ensureCollections() {
  const cols = [
    { name: "chess_users", type: "base", fields: [
      { name: "telegram_id", type: "text", required: true },
      { name: "username",    type: "text", required: false },
      { name: "first_name",  type: "text", required: false },
    ]},
    { name: "chess_games", type: "base", fields: [
      { name: "player_white", type: "text", required: true },
      { name: "player_black", type: "text", required: false },
      { name: "status",       type: "text", required: true },
      { name: "fen",          type: "text", required: true },
      { name: "turn",         type: "text", required: true },
      { name: "winner",       type: "text", required: false },
      { name: "move_count",   type: "number", required: false },
    ]},
    { name: "chess_moves", type: "base", fields: [
      { name: "game_id",   type: "text", required: true },
      { name: "player_id", type: "text", required: true },
      { name: "move",      type: "text", required: true },
      { name: "fen_after", type: "text", required: true },
    ]},
  ];

  for (const col of cols) {
    try {
      await pb.collections.getOne(col.name);
      log('INFO', `Коллекция '${col.name}' уже существует`);
    } catch (err) {
      if (err?.status === 404) {
        try {
          await pb.collections.create(col);
          log('INFO', `Создана коллекция '${col.name}'`);
        } catch (e) {
          log('ERROR', `Не удалось создать '${col.name}'`, e.message);
          if (e.data) log('ERROR', 'Collection creation error details:', e.data);
        }
      } else {
        log('ERROR', `Error checking collection '${col.name}'`, err.message);
      }
    }
  }
}

main().catch(err => { log('CRITICAL', 'Критическая ошибка', err); process.exit(1); });
process.on('SIGINT',  () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
