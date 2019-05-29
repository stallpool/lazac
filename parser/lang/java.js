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
   detect_ref: function (env, st, ed) {
      let ref = [];
      for (let i = st; i <= ed; i ++) {
         let x = env.tokens[i];
         if (x.token === '.') {
            // TODO: use data flow to analyze accessor e.g. (a.b(e, f, g).c().d())
            // ref.push('.');
            continue;
         }
         if (!x.position) continue;
         // XXX: now skip x.class
         if (java_keywords.includes(x.token)) continue;
         // skip string
         if (x.tag === i_common.TAG_STRING || x.tag === i_common.TAG_REGEX) continue;
         ref.push(Object.assign({
            name: x.token,
         }, x.position));
      }
      return ref;
   },
   detect_modifier_backward: function (env, cursor) {
      let modifier = [];
      let st = cursor, x;
      st = i_common.search_prev_skip_spacen(env.tokens, st-1);
      x = env.tokens[st];
      do {
         if (!x) break;
         if (!java_feature_decorator.const_modifier.includes(x.token)) break;
         modifier.unshift(x.token);
         let next_st = i_common.search_prev_skip_spacen(env.tokens, st-1);
         if (next_st < 0) {
            break;
         } else {
            st = next_st;
         }
         x = env.tokens[st];
      } while (true);
      if (env.modifier) modifier = env.modifier.concat(modifier);
      if (env.modifier && env.modifier.length) {
         st = modifier[0].startIndex;
      }
      env.modifier = modifier;
      return st;
   },
   detect_foward_modifier: function (env, cursor, start) {
      let st = cursor-1, x;
      if (start) {
         st = start;
      } else {
         while (st >= 0) {
            x = env.tokens[st];
            // @A() public void b() { ... }
            // public <T> void t() { ... }
            if (x.token === ')' || x.token === '>') {
               let pair = find_scope(env, st);
               if (!pair) return null;
               st = pair.startIndex - 1;
               continue;
            }
            if (x.token === ';' || x.token === '{' || x.token === '}') {
               break;
            }
            st --;
         }
         st = i_common.search_next_skip_spacen(env.tokens, st+1);
      }
      let i = st, step = 0;
      env.modifier = [];
      do {
         x = env.tokens[i];
         if (x.token === '@') {
            step = java_feature_decorator.annotation(env, i);
            if (step === 0) return;
            i = i_common.search_next_skip_spacen(env.tokens, i+step);
            continue;
         }
         if (java_feature_decorator.const_modifier.includes(x.token)) {
            env.modifier.push(x.token);
            i = i_common.search_next_skip_spacen(env.tokens, i+1);
            continue;
         }
         break;
      } while(i < cursor);
      if (!env.modifier.length) delete env.modifier;
      return i;
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
      let type_st = java_feature_decorator.detect_modifier_backward(env, cursor);
      let scope = env.scope_stack[env.scope_stack.length - 1];
      scope.symbol_list = scope.symbol_list || [];
      let scope_item = {};
      if (env.modifier) scope_item.modifier = env.modifier;
      delete env.modifier;
      let ed = i_common.search_next_skip_spacen(env.tokens, cursor+1);
      scope_item.name = env.tokens[ed].token;
      scope_item.position = env.tokens[ed].position;
      let block_st = i_common.search_next_stop(env.tokens, ed+1, ['{']);
      // TODO: insert extends and implements decorator
      let block = find_scope(env, block_st);
      scope_item.block = block;
      scope_item.ref_list = java_feature_decorator.detect_ref(env, type_st, block.startIndex);
      ed = block.endIndex + 1;
      scope_item.type = 'class';
      scope.symbol_list.push(scope_item);
      env.scope_stack.push(scope_item);
      i_decorator.decorate_scope(env, java_features.klass, block.startIndex+1, block.endIndex);
      env.scope_stack.pop();
      return ed - cursor;
   },
   'interface': function (env, cursor) {
      let type_st = java_feature_decorator.detect_modifier_backward(env, cursor);
      let scope = env.scope_stack[env.scope_stack.length - 1];
      scope.symbol_list = scope.symbol_list || [];
      let scope_item = {};
      if (env.modifier) scope_item.modifier = env.modifier;
      delete env.modifier;
      let ed = i_common.search_next_skip_spacen(env.tokens, cursor+1);
      scope_item.name = env.tokens[ed].token;
      scope_item.position = env.tokens[ed].position;
      let block_st = i_common.search_next_stop(env.tokens, ed+1, ['{']);
      // TODO: insert implements decorator
      let block = find_scope(env, block_st);
      scope_item.block = block;
      scope_item.ref_list = java_feature_decorator.detect_ref(env, type_st, block.startIndex);
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
      let type_st = java_feature_decorator.detect_modifier_backward(env, cursor);
      let scope = env.scope_stack[env.scope_stack.length - 1];
      scope.symbol_list = scope.symbol_list || [];
      let scope_item = {};
      if (env.modifier) scope_item.modifier = env.modifier;
      delete env.modifier;
      ed = i_common.search_next_skip_spacen(env.tokens, ed+1);
      scope_item.name = env.tokens[ed].token;
      scope_item.position = env.tokens[ed].position;
      let block_st = i_common.search_next_stop(env.tokens, ed+1, ['{']);
      let block = find_scope(env, block_st);
      scope_item.block = block;
      scope_item.ref_list = java_feature_decorator.detect_ref(env, type_st, block.startIndex);
      ed = block.endIndex + 1;
      scope_item.type = '@interface';
      scope.symbol_list.push(scope_item);
      env.scope_stack.push(scope_item);
      i_decorator.decorate_scope(env, java_features.annotation_interface, block.startIndex+1, block.endIndex);
      env.scope_stack.pop();
      return ed - cursor;
   },
   'enum': function (env, cursor) {
      let type_st = java_feature_decorator.detect_modifier_backward(env, cursor);
      let scope = env.scope_stack[env.scope_stack.length - 1];
      scope.symbol_list = scope.symbol_list || [];
      let scope_item = {};
      if (env.modifier) scope_item.modifier = env.modifier;
      delete env.modifier;
      let ed = i_common.search_next_skip_spacen(env.tokens, cursor+1);
      scope_item.name = env.tokens[ed].token;
      scope_item.position = env.tokens[ed].position;
      let block_st = i_common.search_next_stop(env.tokens, ed+1, ['{']);
      let block = find_scope(env, block_st);
      scope_item.block = block;
      scope_item.ref_list = java_feature_decorator.detect_ref(env, type_st, block.startIndex);
      ed = block.endIndex + 1;
      scope_item.type = 'enum';
      scope.symbol_list.push(scope_item);
      let enum_item_list = [];
      let enum_item_cursor = i_common.search_next_skip_spacen(env.tokens, block.startIndex+1);
      do {
         // should follow as
         // - <EnumItem> ","
         // - <EnumItem> ";"
         // - <EnumItem> "}"
         x = env.tokens[enum_item_cursor];
         if (!x) return 0;
         if (!i_common.is_symbol(x.token)) return 0;
         enum_item_list.push({ name: x.token, position: x.position, type: 'enum_item' });
         enum_item_cursor = i_common.search_next_skip_spacen(env.tokens, enum_item_cursor+1);
         x = env.tokens[enum_item_cursor];
         if (!x) return 0;
         if (x.token === ';' || x.token === '}') break;
         if (x.token !== ',') return 0;
         enum_item_cursor = i_common.search_next_skip_spacen(env.tokens, enum_item_cursor+1);
      } while (true);
      scope_item.symbol_list = enum_item_list;
      env.scope_stack.push(scope_item);
      // TODO: recursive to enum decorator using (enum_item_cursor, block.endIndex)
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
      let throws_check = i_common.search_next_skip_spacen(env.tokens, st+1);
      if (throws_check !== cursor) {
         if (env.tokens[throws_check].token !== 'throws') return 0;
      }
      let scope_item = {};
      let param_range = find_scope(env, st);
      scope_item.param = param_range;
      scope_item.type = 'function';
      st = i_common.search_prev_skip_spacen(env.tokens, param_range.startIndex-1);
      x = env.tokens[st];
      // XXX: when handle with 'new', remove below line
      if (x.token === '>') return 0; // e.g. new A<T> () { }
      scope_item.name = x.token;
      scope_item.position = x.position;
      st = i_common.search_prev_skip_spacen(env.tokens, st-1);
      x = env.tokens[st];
      if (!x) return 0;
      // e.g. public static <T> ArrayList<T>[][] ...
      let modifier_ed = java_feature_decorator.detect_foward_modifier(env, st);
      // TODO: detect generic and return type
      if (env.modifier) scope_item.modifier = env.modifier;
      delete env.modifier;
      let block_range = find_scope(env, cursor);
      scope_item.block = block_range;
      let scope = env.scope_stack[env.scope_stack.length - 1];
      scope.symbol_list = scope.symbol_list || [];
      scope.symbol_list.push(scope_item);
      env.scope_stack.push(scope_item);
      // TODO: insert function insight decorator
      let function_st = cursor;
      if (env.modifier) {
         if (env.modifier[0].endIndex) {
            function_st = env.modifier[0].startIndex;
         } else {
            function_st = i_common.search_prev_stop(env.tokens, modifier_ed-1, [env.modifier[0]]);
         }
      } else {
         function_st = i_common.search_prev_stop(env.tokens, st, ['{', '}', ';']);
      }
      scope_item.ref_list = java_feature_decorator.detect_ref(env, function_st, block_range.endIndex);
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
      java_feature_decorator.detect_foward_modifier(env, cursor);
      // TODO: detect generic and return type
      if (env.modifier) scope_item.modifier = env.modifier;
      delete env.modifier;
      let scope = env.scope_stack[env.scope_stack.length - 1];
      scope.symbol_list = scope.symbol_list || [];
      scope.symbol_list.push(scope_item);
      let function_st = cursor;
      if (env.modifier) {
         if (env.modifier[0].endIndex) {
            function_st = env.modifier[0].startIndex;
         } else {
            function_st = i_common.search_prev_stop(env.tokens, modifier_ed-1, [env.modifier[0]]);
         }
      } else {
         function_st = i_common.search_prev_stop(env.tokens, scope_item.param.startIndex, ['{', '}', ';']);
      }
      scope_item.ref_list = java_feature_decorator.detect_ref(env, function_st, cursor);
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
            position: env.tokens[name_i].position,
            param: param_range,
         };
      }
   },
   'field': function (env, cursor) {
      if (!env.modifier) env.modifier = [];
      let scope = env.scope_stack[env.scope_stack.length - 1];
      // deal with "{};" "int a = 9;;"
      // skip empty statement, e.g. public enum A {};
      //                            ^---> public enum A {} + ;
      let statement_st = i_common.search_prev_skip_spacen(env.tokens, cursor-1);
      let prev_item = scope.symbol_list?scope.symbol_list[scope.symbol_list.length-1]:null;
      if (prev_item) {
         // prev is `enum A {} ... ;`
         if (prev_item.block) {
            if (prev_item.block.endIndex === statement_st) {
               return 0;
            } else {
               // prev is `enum A {} ;;;; ...;`
               statement_st = prev_item.block.endIndex;
            }
         } else {
            // prev is `int a; ... ;`
            do {
               let prev_x = env.tokens[statement_st];
               if (!prev_x) break;
               if (prev_x.token === '}' || prev_x.token === ']' || prev_x.token === ')' || prev_x.token === '>') {
                  let middle_range = find_scope(env, statement_st);
                  statement_st = middle_range.startIndex - 1;
                  continue;
               }
               if (prev_x.token === ';') break;
               statement_st --;
            } while(statement_st >= 0);
         }
      } else {
         statement_st = scope.block.startIndex;
      }
      statement_st = i_common.search_next_skip_spacen(env.tokens, statement_st+1);
      let empty_statement_x = env.tokens[statement_st];
      while (empty_statement_x && empty_statement_x.token === ';') {
         statement_st = i_common.search_next_skip_spacen(env.tokens, statement_st+1);
         empty_statement_x = env.tokens[statement_st];
      }
      let st = java_feature_decorator.detect_foward_modifier(env, cursor, statement_st);
      let field_item = {};
      field_item.type = 'field';
      if (env.modifier && env.modifier.length) field_item.modifier = env.modifier;
      delete env.modifier;
      let last_i = -1;
      let state = 0; // 0 = scan_declare, 1 = assignment
      let fields = [];
      for (let i = st; i < cursor; i ++) {
         let x = env.tokens[i];
         if (state === 0) {
            // skip generic and array
            // e.g. public HashMap<String, List<String>>[][] test = null;
            //             ^
            if (x.token === '<' || x.token === '(' || x.token === '[' || x.token === '{') {
               last_i = -1;
               let type_range = find_scope(env, i);
               if (!type_range) return 0;
               i = type_range.endIndex;
               continue;
            }
            if (x.token === ',' || x.token === ';' || x.token === '=') {
               last_i = i_common.search_prev_skip_spacen(env.tokens, i-1);
               let item = {
                  position: env.tokens[last_i].position,
                  name: env.tokens[last_i].token,
               };
               fields.push(Object.assign(item, field_item));
            }
            if (x.token === '=') {
               state = 1;
            }
         } else if (state === 1) {
            if (x.token === '(' || x.token === '[' || x.token === '{' || x.token === '<') {
               let pair = find_scope(env, i);
               i = pair.endIndex - 1;
               continue;
            }
            if (x.token === ',' || x.token === ';') {
               state = 0;
            }
         }
      }
      scope.ref_list = scope.ref_list.concat(java_feature_decorator.detect_ref(env, statement_st, cursor));
      scope.symbol_list = scope.symbol_list || [];
      fields.forEach((item) => {
         scope.symbol_list.push(item);
      });
      return 1;
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
      scope_item.ref_list = java_feature_decorator.detect_ref(
         env, block_range.startIndex, block_range.endIndex
      );
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

const index_able = [
   'function_declaration', 'function', 'class', 'enum', 'enum_item',
   'interface', '@interface', 'field',
   // TODO: function_lambda, new_class
];
function symbol_map(env) {
   // @require env.scope_tree
   env.symbol_index = {
      java: {}
   };
   env.symbol_ref = [];
   let base_package = env.scope_tree.base || '';
   iterate_tree(env.scope_tree, env.symbol_index.java, env.symbol_ref, base_package);

   function iterate_tree(scope_item, symbol_index, symbol_ref, scope_string) {
      if (index_able.includes(scope_item.type)) {
         let index = symbol_index[scope_item.name];
         if (!Array.isArray(index)) {
            index = [];
            symbol_index[scope_item.name] = index;
         }
         index.push(Object.assign({
            type: scope_item.type,
            scope: scope_string,
         }, scope_item.position));
      }
      if (scope_item.symbol_list && scope_item.symbol_list.length) {
         scope_item.symbol_list.forEach(
            (scope_item) => iterate_tree(
               scope_item, symbol_index, symbol_ref,
               `${scope_string}.${scope_item.name}`
            )
         );
         scope_item.ref_list && scope_item.ref_list.forEach((ref) => {
            ref.scope = scope_string;
            symbol_ref.push(ref);
         });
         // TODO: link scope_item.ref_list
         // register to symbol_ref
         // and then outside, implement link to find right ref
      }
   }
}

function parse(env) {
   tokenize(env);
   // i_extractor.merge_tokens(env, java_combinations);
   i_decorator.decorate_position_linecolumn(env, (item) => {
      if (!item.token) return true;
      if (i_common.is_symbol(item.token)) {
         return false;
      }
      return true;
   });
   env.scope_tree = {};
   env.scope_stack = [ env.scope_tree ];
   i_decorator.decorate_scope(env, java_features._root, 0, env.tokens.length);
   delete env.scope_stack;
   i_decorator.decorate_id(env);
   symbol_map(env);
   let parsed = {
      tokens: env.tokens,
      scope: env.scope_tree,
      symbol_index: env.symbol_index,
      symbol_ref: env.symbol_ref,
   };
   return parsed;
}

module.exports = {
   tokenize: (text) => tokenize({ text }),
   parse: (text) => parse({ text }),
};
