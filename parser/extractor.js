const i_common = require('./common');

/* env = { text, cursor, tokens, ... } */

function extract_symbol(env) {
   let st = env.cursor, ed = st;
   let n = env.text.length;
   let ch;
   while (ed < n) {
      ch = env.text.charAt(ed);
      if (i_common.stops.indexOf(ch) >= 0) break;
      ed ++;
   }
   if (st === ed) {
      // operator
      return {
         token: env.text.substring(st, ed+1)
      };
   } else {
      // symbol
      return {
         token: env.text.substring(st, ed)
      };
   }
}

function extract_comment(env, start, end) {
   let st = env.cursor;
   if (env.text.substring(st, st+start.length) !== start) return null;
   let ed = env.text.indexOf(end, st + start.length);
   if (ed < 0) ed = env.text.length; else ed += end.length;
   return {
      tag: i_common.TAG_COMMENT,
      token: env.text.substring(st, ed)
   };
}

function extract_string(env, start, end, escape_on) {
   let st = env.cursor;
   if (env.text.substring(st, st+start.length) !== start) return null;
   let ed = env.text.indexOf(end, st + start.length);
   if (escape_on) {
      let ed_len = end.length, es_len = escape_on.length;
      while (ed >= 0) {
         ed = env.text.indexOf(end, ed);
         if (back_lookup(env.text, ed, escape_on) % 2 === 0) break;
         ed += ed_len;
      }
   }
   if (ed < 0) ed = env.text.length; else ed += end.length;
   return {
      tag: i_common.TAG_STRING,
      token: env.text.substring(st, ed)
   };

   function back_lookup(text, index, chgroup) {
      let count = 0;
      let len = chgroup.length;
      while (text.substring(index-len, index) === chgroup) {
         index -= len;
         count ++;
      }
      return count;
   }
}

const regex_sufix = ['g', 'i', 'm', 's', 'u', 'y'];
function extract_regex(env, keywords) {
   // e.g. /^test$/gi, /[/]/
   // a=/regex/;   true && /regex/i.test()   replace(/regex/g, '1');
   let n = env.text.length;
   let st = env.cursor;
   let ed = env.text.indexOf('\n', st + 1);
   if (ed < 0) ed = n;
   let ed_pair = env.text.indexOf('/', st + 1);
   if (ed_pair < 0) return null;
   if (ed_pair > ed) return null;
   // search before st, should not be a number or a symbol
   //                   but can be a keyword (e.g. return)
   let t;
   let p = i_common.search_prev(
      env.tokens, env.tokens.length-1,
      (t) => i_common.space.indexOf(t.token) >= 0
   );
   if (p >= 0) {
      t = env.tokens[p];
      if (i_common.stops.indexOf(t.token) < 0) {
         if (keywords && keywords.indexOf(t.token) < 0) {
            return null;
         }
      }
   }
   // search for end position
   let subenv = { text: env.text, cursor: -1 }
   let pair_deep = 0;
   let pair_ch = null;
   let ed_found = false;
   for (let i = env.cursor+1; i < n; i++) {
      let ch = env.text.charAt(i);
      switch (ch) {
         case '[':
         pair_ch = ']';
         case '{':
         pair_ch = pair_ch || '}';
         subenv.cursor = i;
         // no nest; e.g. /([A-Za-z0-9[\]]{2, 3})/
         t = extract_string(subenv, ch, pair_ch, '\\');
         i += t.token.length - 1;
         pair_ch = null;
         break;
         case '(':
         pair_deep ++;
         break;
         case ')':
         pair_deep --;
         break;
         case '\\':
         i ++;
         break;
         case '/': // if pair_deep > 0, error
         ed = i;
         ed_found = true;
         break;
         case '\n': // error
         ed = i-1;
         ed_found = true;
         break;
      }
      if (ed_found) break;
   }
   if (pair_deep) return null;
   if (!ed_found) return null;
   while(ed+1 < n) {
      if (regex_sufix.indexOf(env.text.charAt(ed+1)) < 0) {
         break;
      }
      ed ++;
   }
   return {
      tag: i_common.TAG_REGEX,
      token: env.text.substring(st, ed+1)
   };
}

function extract_feature(env, features) {
   if (!features) return null;
   let i, n, r;
   for (i = 0, n = features.length; i < n; i++) {
      r = features[i](env);
      if (r) return r;
   }
   return null;
}

function extract_tokens_feature_generator(f, args) {
   return (env) => {
      return f(env, ...args);
   };
}

function extract_tokens(env, feature_map) {
   let extract_others = feature_map.default || extract_symbol;
   let n, r, output;
   output = [];
   env.tokens = output;
   n = env.text.length;
   while (env.cursor < n) {
      r = extract_feature(env, feature_map[env.text.charAt(env.cursor)]);
      if (!r) r = extract_others(env);
      if (!r) { /* not belong to any feature; should not be here */ }
      if (!Array.isArray(r)) r = [r];
      r.forEach((x) => {
         output.push(x);
         env.cursor += x.token.length;
         if (x.tag === i_common.TAG_COMMENT) {
            x.comment = x.token;
            x.token = '';
         }
      });
   }
   return output;
}

const merge_terminal = '\0';
function merge_tokens(env, combinations) {
   let trie = build_trie(combinations);
   let result = [];
   let i = 0, n = env.tokens.length;
   for(; i < n; i++) {
      let x = env.tokens[i], o = env.tokens[i];
      let group = [], cursor = trie;
      while (cursor[x.token]) {
         group.push({
            token: x,
            cursor: cursor[x.token],
         });
         cursor = cursor[x.token];
         x = env.tokens[++i];
         if (i >= n) break;
      }
      while (group.length && !cursor[merge_terminal]) {
         -- i;
         cursor = group.pop().cursor;
      }
      if (!group.length) {
         group.push({
            token: o
         });
      } else {
         -- i;
      }
      x = group[0].token;
      group.slice(1).forEach((y) => {
         x.token += y.token.token;
      });
      result.push(x);
   }
   env.tokens = result;
   return result;

   function build_trie(set) {
      let result = {};
      set.forEach((group) => {
         if (!Array.isArray(group)) {
            group = group.split('');
         }
         let cursor = result;
         group.forEach((part) => {
            if (!cursor[part]) cursor[part] = {};
            cursor = cursor[part];
         });
         cursor[merge_terminal] = group.join('');
      });
      return result;
   }
}

//console.log(extract_comment({text: 'aa//"test\\"test" test', cursor: 2}, '//', '\n'));
//console.log(extract_string({text: 'aa"test\\"test" test', cursor: 2}, '"', '"', '\\'));

module.exports = {
   extract_symbol,
   extract_comment,
   extract_string,
   extract_regex,
   extract_feature,
   extract_tokens_feature_generator,
   extract_tokens,
   merge_tokens
};
