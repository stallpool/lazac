/* regex? */
function test() {
   return /"/.test('xxx"xxx');
}

function nouse() {
   return /[/]/.test('//');
}

p = () => (
   0
) +
(1)

p1 = () => (
   0
) +

(2);
function p0() {}
console.log(p(), p1());

dd = [class {}]
class A09 {}
class A10 {}
class A11 extends dd[0] {
   constructor(a, ...b) {}
}
p = {}
p.class = 1;
class A00 extends {test: class B00{} }['test'] {}

xxx = class extends A11 {}

a = '';
b = 1; gi = 1
console.log(test());
a = a.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g,"@").replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/);
a = 2 /*test*/ / /test/.test('a');
a = 3 /*test*/ / parseInt(/.+/.exec('3f23fg')[0]);
console.log(a);

b = 1
a = () => b
2 + (b=2), 3
b = 6
console.log(a(),b);
(b)

function testx() {
   p0();
   setTimeout(() => p0(), 0);
   setTimeout(() => {
      console.log('timeout from testx', p0());
   }, 100);

   function p0() {}
}

if (a === 1) {
   b = 2
} else if (a === 2) b = 3
else b = 4
c = 1
x = a/b/gi; y = /b/gi;

