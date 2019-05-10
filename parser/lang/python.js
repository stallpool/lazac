const i_common = require('../common');
const i_extractor = require('../extractor');
const i_decorator = require('../decorator');

const python_extract_feature = {
   '"': [extract_doc_string_d, extract_string_d],
   '\'': [extract_doc_string_s, extract_string_s],
   '#': [extract_line_comment],
};

function extract_doc_string_d(env) {
   return i_extractor.extract_string(env, '"""', '"""', '\\');
}

function extract_doc_string_s(env) {
   return i_extractor.extract_string(env, '\'\'\'', '\'\'\'', '\\');
}

function extract_string_d(env) {
   return i_extractor.extract_string(env, '"', '"', '\\');
}

function extract_string_s(env) {
   return i_extractor.extract_string(env, '\'', '\'', '\\');
}

function extract_line_comment(env) {
   return i_extractor.extract_comment(env, '#', '\n');
}

const python_keywords = [
   // ref:
   // - https://github.com/python/cpython/blob/2.7/Lib/keyword.py
   // - https://github.com/python/cpython/blob/3.7/Lib/keyword.py
   'and', 'as', 'assert', 'break', 'class', 'continue', 'def',
   'del', 'elif', 'else', 'except', 'finally', 'while', 'with',
   'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda',
   'not', 'or', 'pass', 'raise', 'return', 'try', 'yield',
   /* 2 */ 'print', 'exec',
   /* 3 */ 'False', 'None', 'True', 'async', 'await', 'nonlocal',
];

const python_combinations = [
   '**', '++', '--', '+=', '-=', '*=', '/=', '%=', '==', '!=', '<>',
   '>=', '<=', '<<', '>>', '&=', '|=', '^=', '<<=', '>>=', '//',
   '//=', '**='
];

const python_decorate_feature = {
};

function decorate_import(env) {
   // import os
   // from os import getenv
   // from math import abs, sin, cos
   // from subprocess import ( PIPE, Popen, MAXFD )
}

function decorate_class(env) {
   // class A
   // class A()
   // class A(object)
   // class A(B, C)
}

function decorate_function(env) {
   // def a()
   // def a(t1, *args, **kwargs)
   // def a(t1, t2=None)
}

function decorate_lambda_function(env) {
   // lambda x, y: expression
}


function decorate_annotation(env) {
   // will cause syntax error:
   // - @wrap_factory_create()(...)
   // - @wrap_dict[...](...)
   // thus @symbol(...)
}

function tokenize(env) {
   env.cursor = 0;
   i_extractor.extract_tokens(env, python_extract_feature);
   return env.tokens;
}

function parse(env) {
   tokenize(env);
   return env.tokens;
}

module.exports = {
   tokenize: (text) => tokenize({ text }),
   parse: (text) => parse({ text }),
};