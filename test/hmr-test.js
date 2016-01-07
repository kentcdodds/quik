'use strict';

const test = require('ava');
const path = require('path');
const fs = require('fs');
const EventSource = require('eventsource');
const server = require('../src/server');

test.cb('should rebuild on changes', t => {
    const s = server({
        root: path.join(__dirname, '../template'),
        watch: [ './index.js' ]
    }).listen(3005);

    const componentFile = path.join(__dirname, '../template', 'MyComponent.js');

    function change(from, to) {
        fs.readFile(componentFile, 'utf-8', (err, res) => {
            if (err) {
                t.end(err);
            } else {
                fs.writeFile(componentFile, res.toString().replace(from, to), 'utf-8', e => {
                    if (e) {
                        t.end(e);
                    }
                });
            }
        });
    }

    t.plan(8);

    const hmr = new EventSource('http://localhost:3005/__webpack_hmr');

    hmr.onopen = message => {
        t.same(message.type, 'open', 'should open connection');

        setTimeout(() => change('Hello world!', 'Hello world :D'), 1000);
        setTimeout(() => change('Hello world', 'Hola world'), 5000);
        setTimeout(() => change('Hola world :D', 'Hello world!'), 7000);
    };

    let i = 0;
    let action = 'building';

    hmr.onmessage = message => {
        const data = message.data;

        if (i === 6) {
            t.same(data, '💓', 'should recieve heartbeat');

            hmr.close();
            s.close();
            t.end();

            return;
        }

        if (data === '💓') {
            return;
        }

        try {
            const parsed = JSON.parse(data);

            t.same(parsed.action, action);

            switch (parsed.action) {
            case 'building':
                action = 'built';
                break;
            case 'built':
                action = 'building';
                break;
            }

            i++;
        } catch (err) {
            t.end(err);
        }
    };
});