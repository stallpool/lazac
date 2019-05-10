
const debug = {
   group_text: (env, x) => {
      if (!x) return '';
      return env.tokens.slice(
         x.startIndex, x.endIndex
      ).map(
         (x) => x.token
      ).join('');
   },
   import_text: (env, token) => {
      token.debug = {
         base: debug.group_text(env, token.base),
         import: token.import.map((x) => debug.group_text(env, x)),
      };
   },
   class_text: (env, token) => {
      token.debug = {
         name: env.tokens[token.name].token,
         inherit: token.inherit.map((x) => debug.group_text(env, x)),
         annotation: token.annotation?token.annotation.map(
            (x) => debug.group_text(env, env.tokens[x].name)
         ):[],
      }
   },
   function_text: (env, token) => {
      token.debug = {
         name: token.name?env.tokens[token.name].token:'',
         annotation: token.annotation?token.annotation.map(
            (x) => debug.group_text(env, env.tokens[x].name)
         ):[],
      }
   }
};

module.exports = debug;