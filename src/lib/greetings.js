// Instant replies for messages that are ONLY a greeting, thanks, goodbye, introduction or "who are you" (same patterns as
// the workflow's Quick Chat Check), so they never wait on n8n or Gemini. Anything else goes to the workflow.
// "ok" / "okay" are not handled here: after a "Which client do you mean?" menu they mean "yes".

import { randomExamples } from './clients.js';

const HELLO = '(?:hi+|hello|hey+|heya|hiya|yo|howdy|g ?day|good (?:morning|afternoon|evening|day))';
const THANKS = '(?:thanks|thank you|thx|cheers)';
const BYE = '(?:bye|goodbye)';
const GREET = `(?:${HELLO}|${THANKS}|${BYE})`;
const TAIL = '(?: there| mate| team| all| everyone| again)?';
const ABOUT = '(?:who are you|what are you|who is this|how are you(?: doing)?|how s it going|what can you do|what do you do|nice to meet you)';

const ONLY_GREETING = new RegExp(`^${GREET}${TAIL}(?: ${GREET}${TAIL})?$`);
// "..., please remember it" / "and remember my name" after an introduction
const REMEMBER = '(?:(?:and )?(?:please )?remember(?: it| that| me| my name| this)?(?: please)?)';
// the second name word is lazy, so "Kael please remember it" keeps "Kael" as the name
const INTRO = new RegExp(`^(?:${GREET}${TAIL} )?(?:my name is|my name s|i am|i m|im|call me) ([a-z]+(?: [a-z]+)??)(?: ${REMEMBER})?(?: ${ABOUT})?$`);
const ABOUT_ONLY = new RegExp(`^(?:${GREET}${TAIL} )?${ABOUT}(?: today)?$`);

// the assistant just asked something the next message may answer (the workflow keeps those turns)
const OPEN_QUESTION = /Which client (?:do you mean|would you like|should I)|Reply with the number|reply \*\*2\*\*/i;

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

// headings over the example questions after a greeting
const EXAMPLES_HEADS = ['**Try for example:**', '**Here are a few ideas:**', '**You could ask:**', '**A few things to try:**'];
// lead-ins over the example questions after an off-topic answer
const BRIDGE_HEADS = [
  "By the way, I'm best at answering questions about your clients' landing pages. You could try:",
  "That's a little outside my usual work, but happy to help! When you're ready, try asking about a client:",
  'Want to check on a client next? Here are a few things you can ask:',
  "Whenever you're ready, I can look up any client's landing pages. For example:",
  'Need anything from the master sheet? You could ask:',
  "If you'd like to get back to client work, here are a few quick questions to try:",
  "I can also help you keep track of your clients' landing pages. Try one of these:",
];
const ALL_HEADS = [...EXAMPLES_HEADS, ...BRIDGE_HEADS];

// the chat's latest message with an example list, and the heading it used
function lastExamples(prior) {
  for (let i = prior.length - 1; i >= 0; i--) {
    const m = prior[i];
    const head = m.role === 'assistant' && ALL_HEADS.find((h) => (m.content || '').includes(h));
    if (head) return { content: m.content, head };
  }
  return null;
}

// a random heading from `heads`, never the one the chat used last time
function freshHead(heads, before) {
  return pick(heads.filter((h) => h !== before?.head));
}

// random example questions, none repeated from the chat's previous example list (greeting or off-topic bridge)
function exampleLines(client, clients, before) {
  const avoid = before ? before.content.split(before.head)[1].split('\n').filter((l) => l.startsWith('- ')) : [];
  return randomExamples(clients, { client, avoid }).map((l) => `- ${l}`).join('\n');
}

function examples(client, clients, prior) {
  const before = lastExamples(prior);
  return freshHead(EXAMPLES_HEADS, before) + '\n\n' + exampleLines(client, clients, before);
}

// the workflow's off-topic bridge (the old "Just a heads-up!" block or the new "By the way" one) and the line before it
const WORKFLOW_BRIDGE = /(?:\n\s*(?:-{3,}|\*{3,}|_{3,})\s*)?\n*\s*(?:Just a heads-up!|By the way, I'm best at answering)[\s\S]*$/;

/**
 * A workflow answer to an off-topic question with its example block swapped for the app's random, non-repeating
 * one, so every off-topic answer gets fresh examples. Other answers come back unchanged.
 */
export function withAppExamples(text, { prior = [], client = null, clients = null } = {}) {
  if (!WORKFLOW_BRIDGE.test(text)) return text;
  const answer = text.replace(WORKFLOW_BRIDGE, '').trim();
  const before = lastExamples(prior);
  const bridge = freshHead(BRIDGE_HEADS, before) + '\n\n' + exampleLines(client, clients, before);
  return answer ? `${answer}\n\n---\n\n${bridge}` : bridge;
}

const HELP = "I can look up any client's landing pages, status, plans and reports.";

// a last word close to "today" ("todya", "dotday") counts as "today"
function nearToday(word) {
  const b = 'today';
  if (Math.abs(word.length - b.length) > 2) return false;
  let prev = [...Array(b.length + 1).keys()];
  for (let i = 1; i <= word.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (word[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length] <= 2;
}

/**
 * Returns an instant markdown reply for a pure greeting / small-talk message, or null when the workflow should answer.
 * `prior`: the chat's earlier messages; `client`: the chat's client ({ sheet, name }) when it is bound to one;
 * `clients`: the client list, for the random example questions.
 */
export function localGreeting(text, { prior = [], client = null, clients = null } = {}) {
  let t = String(text || '').toLowerCase().replace(/['’]/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
  if (!t) return null;
  const words = t.split(' ');
  if (words.length > 1 && nearToday(words[words.length - 1])) t = [...words.slice(0, -1), 'today'].join(' ');
  const lastAssistant = [...prior].reverse().find((m) => m.role === 'assistant');
  if (lastAssistant && OPEN_QUESTION.test(lastAssistant.content || '')) return null;

  const ex = () => examples(client, clients, prior);
  const intro = t.match(INTRO);
  if (intro) {
    return `Nice to meet you, ${titleCase(intro[1])}! 👋 ${HELP} Which client shall we check?\n\n${ex()}`;
  }
  if (ABOUT_ONLY.test(t)) {
    if (/how are you|how s it going/.test(t)) return `I'm doing great, thanks for asking! 😊 ${HELP}\n\n${ex()}`;
    return `I'm the **Landing Page Assistant**. ${HELP} Include the client name in your question for the best results.\n\n${ex()}`;
  }
  if (!ONLY_GREETING.test(t)) return null;
  if (new RegExp(`^${BYE}`).test(t)) return pick(['Bye for now! 👋 Come back any time you need landing page info.', 'Goodbye! 👋 Happy to help again whenever you need.']);
  if (new RegExp(`^${THANKS}`).test(t)) return pick(["You're welcome! 😊 Anything else I can check for you?", 'No worries! Let me know if you need anything else.']);
  const forClient = client?.sheet ? ` What would you like to know about **${client.name || client.sheet}**?` : ' How can I help you today?';
  return pick(['Hi there! 👋', 'Hello! 👋', 'Hey! 👋']) + ` I'm your Landing Page Assistant.${forClient}\n\n${ex()}`;
}
