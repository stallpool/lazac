const i_common = require('./common');

const common_left_bracket  = ['(', '{', '['];
const common_right_bracket = [')', '}', ']'];
const common_left_right_bracket_map = {
   '(': ')', '{': '}', '[': ']', '<': '>'
};

/* env = { tokens, cursor, ...} */

function decorate_skip_current_line(env) {
   let st = env.cursor;
   let ed = i_common.search_next(env.tokens, st+1, (x) => x.token !== '\n');
   return ed - st + 1;
}

function decorate_bracket(env) {
   let stack = [];
   let i, n, ch, token;
   for (i = 0, n = env.tokens.length; i < n; i++) {
      token = env.tokens[i];
      ch = token.token;
      if (common_left_bracket.indexOf(ch) >= 0) {
         stack.push({i: i, ch: common_left_right_bracket_map[ch]});
         token.startIndex = i;
         token.tag = i_common.TAG_BRACKET[ch];
      } else if (common_right_bracket.indexOf(ch) >= 0) {
         let pair = stack.pop();
         if (pair.ch !== ch) { /* bracket not match; should not be here */ }
         env.tokens[pair.i].endIndex = i+1;
      }
   }
   return env.tokens.length;
}

function decorate_keywords(env, keywords) {
   env.tokens.forEach((token) => {
      if (keywords.indexOf(token.token) >= 0) {
         token.tag = i_common.TAG_KEYWORD;
      }
   });
   return env.tokens.length;
}

function decorate_feature(env, features, cursor) {
   if (!features) return 0;
   let i, n, r;
   for (i = 0, n = features.length; i < n; i++) {
      r = features[i](env, cursor);
      if (r > 0) return r;
   }
   return 0;
}

function decorate_scope(env, feature_map, st, ed, feature_default_fn) {
   let decorate_others = feature_default_fn;
   let r = st || 0, n;
   if (ed) {
      n = ed - st;
   } else {
      n = env.tokens.length - st;
   }
   let cursor = r;
   while (cursor < ed) {
      let name = env.tokens[cursor].token;
      let features = feature_map[name];
      if (Array.isArray(features)) {
         // we do not define 'constructor' rule but dict has 'constructor' key
         // if there is a token 'constructor', it will hit dict 'constructor' function
         // therefore, add condition to avoid that dict['constructor'] may cause error
         r = decorate_feature(env, features, cursor);
      } else {
         r = 0;
      }
      if (!r) r = decorate_others && decorate_others(env, cursor) || 1;
      cursor += r;
   }
   env.cursor = cursor;
   return env.tokens;
}

function decorate_position_linecolumn(env, skip_decorate_fn) {
   let line_number = 1, column = 1;
   env.tokens.forEach((x) => {
      if (!skip_decorate_fn || !skip_decorate_fn(x)) {
         x.position = {
            lineNumber: line_number,
            column: column,
         };
      }
      let value = x.token || x.comment;
      let lines = value.split('\n');
      if (lines.length === 1) {
         column += lines[0].length;
      } else {
         line_number += lines.length - 1;
         column = 1 + lines[lines.length - 1].length;
      }
   });
}

function decorate_position_offset(env, skip_decorate_fn) {
   let offset = 0;
   env.tokens.forEach((x) => {
      if (!skip_decorate_fn || !skip_decorate_fn(x)) {
         x.position = { offset };
      }
      let value = x.token || x.comment;
      offset += value.length;
   });
}

function decorate_id(env) {
   env.tokens.forEach((x, i) => {
      x.id = i;
   });
}

function decorate_cpp_style_group(env) {
   decorate_nested_group(env, 0);

   /**
    *  ; () {       ;     ;        }
    *    ^^ startBracketIndex/endBracketIndex
    *   ^~~~~~~~~~~~~~~~~~~~~~~~~~~^ startUnitIndex/endUnitIndex
    */
   function decorate_nested_group(env, st) {
      let last_st = st;
      for(let i = st, n = env.tokens.length; i < n; i++) {
         let x = env.tokens[i];
         if (x.token === ';') {
            x = env.tokens[last_st];
            x.startUnitIndex = last_st;
            x.endUnitIndex = i;
            last_st = i + 1;
            continue;
         }
         if (x.token === '{') {
            i = decorate_nested_group(env, i + 1);
            x = env.tokens[last_st];
            x.startUnitIndex = last_st;
            x.endUnitIndex = i;
            last_st = i + 1;
            continue;
         }
         if (x.token === '}') {
            return i;
         }
         if (x.token === '(' || x.token === '[') {
            i = decorate_nested_group(env, i + 1);
            continue;
         }
         if (x.token === ')' || x.token === ']') {
            x = env.tokens[st - 1];
            x.startBracketIndex = st - 1;
            x.endBracketIndex = i;
            return i;
         }
      }
      return env.tokens.length;
   }
}

module.exports = {
   decorate_skip_current_line,
   decorate_bracket,
   decorate_keywords,
   decorate_scope,
   decorate_position_linecolumn,
   decorate_position_offset,
   decorate_id,
   decorate_cpp_style_group,
};