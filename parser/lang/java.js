const i_common = require('../common');
const i_extractor = require('../extractor');
const i_decorator = require('../decorator');

const java_extract_feature = {
   '"': [extract_string],
   '\'': [extract_char],
   '/': [extract_line_comment, extract_multiline_comment]
};

function extract_string(env) {
   return i_extractor.extract_string(env, '"', '"', '\\');
}

function extract_char(env) {
   return i_extractor.extract_string(env, '\'', '\'', '\\');
}

function extract_line_comment(env) {
   return i_extractor.extract_comment(env, '//', '\n');
}

function extract_multiline_comment(env) {
   return i_extractor.extract_comment(env, '/*', '*/');
}

const java_keywords = [
   // ref:
   // - https://docs.oracle.com/javase/tutorial/java/nutsandbolts/_keywords.html
   'abstract', 'continue', 'for', 'new', 'switch', 'assert', 'default', 'goto', 'package', 'synchronized',
   'boolean', 'do', 'if', 'private', 'this', 'break', 'double', 'implements', 'protected', 'throw',
   'byte', 'else', 'import', 'public', 'throws', 'case', 'enum', 'instanceof', 'return', 'transient',
   'catch', 'extends', 'int', 'short', 'try', 'char', 'final', 'interface', 'static', 'void',
   'class', 'finally', 'long', 'strictfp', 'volatile', 'const', 'float', 'native', 'super', 'while',
   '@interface',
];

const java_combinations = [
   '!=', '+=', '-=', '~=', '|=', '&=', '^=', '++', '>=',
   '&&', '||', '>>', '<<', '%=', '*=', '/=', '--', '<=',
   '->', '>>>', '%=', '<<=', '>>=', '>>>=', '...',
   ['@', 'interface'],
];

function tokenize(env) {
   env.cursor = 0;
   i_extractor.extract_tokens(env, java_extract_feature);
   return env.tokens;
}

const java_feature_decorator = {
   const_modifier: [
      'public', 'private', 'default', 'abstract', 'static', 'synchronized',
      'protected', 'transient', 'strictfp', 'volatile', 'const', 'native',
   ],
   detect_modifier: function (env, cursor) {
      let modifier = [];
      let st = cursor, x;
      st = i_common.search_prev_skip_spacen(env.tokens, st-1);
      x = env.tokens[st];
      do {
         if (!x) break;
         if (!java_feature_decorator.const_modifier.includes(x.token)) break;
         modifier.unshift(x.token);
         st = i_common.search_prev_skip_spacen(env.tokens, st-1);
         x = env.tokens[st];
      } while (true);
      if (env.modifier) modifier = env.modifier.concat(modifier);
      delete env.modifier;
      if (!modifier.length) return null;
      return modifier;
   },
   'package': function (env, cursor) {
      let index = i_common.search_next_stop(env.tokens, cursor+1, [';', '\n']);
      let x = env.tokens[index];
      if (x.token === '\n') return 0;
      let scope = env.scope_stack[env.scope_stack.length - 1];
      scope.base = env.tokens.slice(cursor+1, index).map((x) => x.token).join('').trim();
      return index - cursor + 1;
   },
   'import': function (env, cursor) {
      let st = i_common.search_next_skip_spacen(env.tokens, cursor+1);
      let x = env.tokens[st];
      if (!x) return 0;
      let scope = env.scope_stack[env.scope_stack.length - 1];
      let search_item = {};
      if (!scope.import_list) scope.import_list = [];
      if (x.token === 'static') {
         st = i_common.search_next_skip_spacen(env.tokens, st+1);
         search_item.pattern = '*';
      }
      let ed = i_common.search_next_stop(env.tokens, cursor+1, [';', '\n']);
      let path = env.tokens.slice(st, ed).map((x) => x.token).join('').trim();
      if (search_item.pattern) {
         search_item.path = path;
      } else {
         search_item.path = path.split('.');
         search_item.pattern = search_item.path[search_item.path.length-1];
         search_item.path = path.substring(0, path.length - search_item.pattern.length - 1);
      }
      scope.import_list.push(search_item);
      return 0;
   },
   'klass': function (env, cursor) {
      let st = i_common.search_prev_skip_spacen(env.tokens, cursor-1);
      let x = env.tokens[st];
      if (x && x.token === '.') return 0; // e.g. Reflect.class
      let modifier = java_feature_decorator.detect_modifier(env, cursor);
      let scope = env.scope_stack[env.scope_stack.length - 1];
      scope.symbol_list = scope.symbol_list || [];
      let scope_item = {};
      if (modifier) scope_item.modifier = modifier;
      let ed = i_common.search_next_skip_spacen(env.tokens, cursor+1);
      scope_item.name = env.tokens[ed].token;
      let block_st = i_common.search_next_stop(env.tokens, ed+1, ['{']);
      // TODO: insert extends and implements decorator
      let block = find_scope(env, block_st);
      scope_item.block = block;
      ed = block.endIndex + 1;
      scope_item.type = 'class';
      scope.symbol_list.push(scope_item);
      env.scope_stack.push(scope_item);
      i_decorator.decorate_scope(env, java_features.klass, block.startIndex+1, block.endIndex);
      env.scope_stack.pop();
      return ed - cursor;
   },
   'interface': function (env, cursor) {
      let modifier = java_feature_decorator.detect_modifier(env, cursor);
      let scope = env.scope_stack[env.scope_stack.length - 1];
      scope.symbol_list = scope.symbol_list || [];
      let scope_item = {};
      if (modifier) scope_item.modifier = modifier;
      let ed = i_common.search_next_skip_spacen(env.tokens, cursor+1);
      scope_item.name = env.tokens[ed].token;
      let block_st = i_common.search_next_stop(env.tokens, ed+1, ['{']);
      // TODO: insert implements decorator
      let block = find_scope(env, block_st);
      scope_item.block = block;
      ed = block.endIndex + 1;
      scope_item.type = 'interface';
      scope.symbol_list.push(scope_item);
      env.scope_stack.push(scope_item);
      i_decorator.decorate_scope(env, java_features.interface, block.startIndex+1, block.endIndex);
      env.scope_stack.pop();
      return ed - cursor;
   },
   'annotation_interface': function (env, cursor) {
      let ed = i_common.search_next_skip_spacen(env.tokens, cursor+1);
      let x = env.tokens[ed];
      if (!x) return 0;
      if (x.token !== 'interface') return 0;
      let modifier = java_feature_decorator.detect_modifier(env, cursor);
      let scope = env.scope_stack[env.scope_stack.length - 1];
      scope.symbol_list = scope.symbol_list || [];
      let scope_item = {};
      if (modifier) scope_item.modifier = modifier;
      ed = i_common.search_next_skip_spacen(env.tokens, ed+1);
      scope_item.name = env.tokens[ed].token;
      let block_st = i_common.search_next_stop(env.tokens, ed+1, ['{']);
      let block = find_scope(env, block_st);
      scope_item.block = block;
      ed = block.endIndex + 1;
      scope_item.type = '@interface';
      scope.symbol_list.push(scope_item);
      env.scope_stack.push(scope_item);
      i_decorator.decorate_scope(env, java_features.annotation_interface, block.startIndex+1, block.endIndex);
      env.scope_stack.pop();
      return ed - cursor;
   },
   'enum': function (env, cursor) {
      let modifier = java_feature_decorator.detect_modifier(env, cursor);
      let scope = env.scope_stack[env.scope_stack.length - 1];
      scope.symbol_list = scope.symbol_list || [];
      let scope_item = {};
      if (modifier) scope_item.modifier = modifier;
      let ed = i_common.search_next_skip_spacen(env.tokens, cursor+1);
      scope_item.name = env.tokens[ed].token;
      let block_st = i_common.search_next_stop(env.tokens, ed+1, ['{']);
      let block = find_scope(env, block_st);
      scope_item.block = block;
      ed = block.endIndex + 1;
      scope_item.type = 'enum';
      scope.symbol_list.push(scope_item);
      env.scope_stack.push(scope_item);
      // TODO: detect enum items
      // TODO: recursive to enum decorator
      env.scope_stack.pop();
      return ed - cursor;
   },
   'annotation': function (env, cursor) {
      let x = env.tokens[cursor+1];
      if (!x) return 0;
      if (x.token === 'interface') return 0; // pass to @interface decorator
      let ed = i_common.search_next_stop(env.tokens, cursor+1, ['(', ' ', '\t', '\n']);
      x = env.tokens[ed];
      if (!x) return 0;
      if (x.token === '(') {
         let range = find_scope(env, ed);
         // TODO: recursive to annotation expression decorator
         ed = range.endIndex + 1;
      }
      if (!env.modifier) env.modifier = [];
      let modifier_item = {
         type: 'annotation',
         startIndex: cursor,
         endIndex: ed,
      };
      env.modifier.push(modifier_item);
      return ed - cursor;
   },
   'function': function (env, cursor) {
      let st = i_common.search_prev_stop(env.tokens, cursor-1, [')']);
      if (st < 0) return 0;
      let scope_item = {};
      let param_range = find_scope(env, st);
      scope_item.param = param_range;
      scope_item.type = 'function';
      st = i_common.search_prev_skip_spacen(env.tokens, param_range.startIndex-1);
      x = env.tokens[st];
      // XXX: when handle with 'new', remove below line
      if (x.token === '>') return 0; // e.g. new A<T> () { }
      scope_item.name = x.token;
      st = i_common.search_prev_skip_spacen(env.tokens, st-1);
      x = env.tokens[st];
      if (!x) return 0;
      // TODO: detect modifier, generic, return type
      // e.g. public static <T> ArrayList<T>[][] ...
      let block_range = find_scope(env, cursor);
      scope_item.block = block_range;
      delete env.modifier;
      let scope = env.scope_stack[env.scope_stack.length - 1];
      scope.symbol_list = scope.symbol_list || [];
      scope.symbol_list.push(scope_item);
      env.scope_stack.push(scope_item);
      // TODO: insert function insight decorator
      env.scope_stack.pop();
      return block_range.endIndex - cursor + 1;
   },
   'statement': function (env, cursor) {
      delete env.modifier;
      return 0;
   },
   'function_declare': function (env, cursor) {
      let scope_item = get_function(env, cursor-1);
      if (!scope_item) return 0;
      // TODO: detect modifier, generic, return type
      delete env.modifier;
      let scope = env.scope_stack[env.scope_stack.length - 1];
      scope.symbol_list = scope.symbol_list || [];
      scope.symbol_list.push(scope_item);
      return 1;

      function get_function(env, ed) {
         let st = ed, x;
         let no_assign = true;
         let param_range = null;
         while (st >= 0) {
            x = env.tokens[st];
            if (!x) break;
            if (x.token === '{' || x.token === '}' || x.token === ';') break;
            if (x.token === ')') {
               param_range = find_scope(env, st);
               st = param_range.startIndex;
            } else if (x.token === '=') {
               no_assign = false;
               break;
            }
            st --;
         }
         if (!no_assign || !param_range) return null;
         let name_i = i_common.search_prev_skip_spacen(env.tokens, param_range.startIndex-1);
         return {
            type: 'function_declaration',
            name: env.tokens[name_i].token,
            param: param_range,
         };
      }
   },
   'field': function (env, cursor) {
      delete env.modifier;
      return 0;
   },
   'init_block': function (env, cursor) {
      let st = i_common.search_prev_skip_spacen(env.tokens, cursor-1);
      let x = env.tokens[st];
      let static_block = false;
      if (x && x.token === 'static') {
         st = i_common.search_prev_skip_spacen(env.tokens, st-1);
         x = env.tokens[st];
         static_block = true;
      }
      if (x) {
         if (x.token !== '{' && x.token !== '}' && x.token !== ';') return 0;
         // pass to function decorator
      }
      let block_range = find_scope(env, cursor);
      delete env.modifier;
      let scope_item = {};
      scope_item.type = 'blcok';
      if (static_block) {
         scope_item.subtype = 'static_init'
      } else {
         scope_item.subtype = 'init';
      }
      scope_item.block = block_range;
      let scope = env.scope_stack[env.scope_stack.length - 1];
      scope.symbol_list = scope.symbol_list || [];
      scope.symbol_list.push(scope_item);
      env.scope_stack.push(scope_item);
      // TODO: insert function insight decorator
      env.scope_stack.pop();
      return block_range.endIndex - cursor + 1;
   }
};

const java_features = {
   _root: {
      'package': [java_feature_decorator.package],
      'import': [java_feature_decorator.import],
      'class': [java_feature_decorator.klass],
      'interface': [java_feature_decorator.interface],
      'enum': [java_feature_decorator.enum],
      '@': [
         java_feature_decorator.annotation,
         java_feature_decorator.annotation_interface,
      ], // @interface, @Annotation
   },
   klass: {
      ';': [
         java_feature_decorator.function_declare,
         java_feature_decorator.field,
      ],
      'class': [java_feature_decorator.klass],
      'interface': [java_feature_decorator.interface],
      'enum': [java_feature_decorator.enum],
      '@': [
         java_feature_decorator.annotation,
         java_feature_decorator.annotation_interface,
      ],
      '{': [
         java_feature_decorator.init_block, // { }, static { }
         java_feature_decorator.function,
      ],
   },
   interface: {
      ';': [
         java_feature_decorator.function_declare,
         java_feature_decorator.field,
      ],
      'class': [java_feature_decorator.klass],
      'interface': [java_feature_decorator.interface],
      'enum': [java_feature_decorator.enum],
      '@': [
         java_feature_decorator.annotation,
         java_feature_decorator.annotation_interface,
      ],
      '{': [
         java_feature_decorator.init_block, // { }, static { }
         java_feature_decorator.function, // default void f(x) { }
      ],
   },
   enum: {
      ';': [
         java_feature_decorator.function_declare,
         java_feature_decorator.field,
      ],
      'class': [java_feature_decorator.klass],
      'interface': [java_feature_decorator.interface],
      'enum': [java_feature_decorator.enum],
      '@': [
         java_feature_decorator.annotation,
         java_feature_decorator.annotation_interface,
      ],
      '{': [
         java_feature_decorator.init_block, // { }, static { }
         java_feature_decorator.function, // default void f(x) { }
      ],
   },
   annotation_interface: {
      ';': [
         java_feature_decorator.function_declare,
         java_feature_decorator.field,
      ],
      'class': [java_feature_decorator.klass],
      'interface': [java_feature_decorator.interface],
      'enum': [java_feature_decorator.enum],
      '@': [
         java_feature_decorator.annotation,
         java_feature_decorator.annotation_interface,
      ],
   },
}

function find_scope(env, index) {
   let pair = i_common.detect_pair(env.tokens, index);
   if (!pair || pair.endIndex >= env.tokens.length) {
      throw "pair_mismatch";
   }
   return pair;
}

function parse(env) {
   tokenize(env);
   // i_extractor.merge_tokens(env, java_combinations);
   i_decorator.decorate_position_linecolumn(env, (item) => {
      if (!item.token) return true;
      let ch = item.token.charAt(0);
      if (i_common.stops.includes(ch)) return true;
      return false;
   });
   env.scope_tree = {};
   env.scope_stack = [ env.scope_tree ];
   i_decorator.decorate_scope(env, java_features._root, 0, env.tokens.length);
   delete env.scope_stack;
   i_decorator.decorate_id(env);
   console.log(JSON.stringify(env.scope_tree, null, 4));
   return env.tokens;
}

module.exports = {
   tokenize: (text) => tokenize({ text }),
   parse: (text) => parse({ text }),
};
