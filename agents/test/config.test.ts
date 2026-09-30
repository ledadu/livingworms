import './env.mjs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { askPath, briefPath, clientSettings, DEFAULTS, merge, project, releaseName, renderPage, renderText, shellVariables } from '../config.mjs';
import { buildMap, hubMap, MAP_SIZE, NODE_SIZE } from '../agent/hub.mjs';
import example from '../agents.config.example.mjs';

const here = dirname(fileURLToPath(import.meta.url));

describe('the settings of the project', () => {
  it('merges the project over the defaults, key by key for objects, as a whole for the rest', () => {
    const merged = merge(DEFAULTS, { name: 'X', branches: { integration: 'dev' }, paths: { design: ['a/*'] } });
    expect(merged.name).toBe('X');
    expect(merged.branches).toMatchObject({ main: 'main', integration: 'dev', agent: 'agent/' });
    expect(merged.paths.design).toEqual(['a/*']);
    expect(merged.paths.backlog).toBe('docs/backlog.md');
    const states = () => ({});
    expect(merge(DEFAULTS, { hub: { states } }).hub.states).toBe(states);
  });

  it('reads the project named by AGENTS_CONFIG', () => {
    expect(project.name).toBe('Jeu de test');
    expect(project.release.word).toBe('génération');
    expect(project.services.server.command).toBe('npm run dev:server');
    // What the fixture leaves out keeps its default.
    expect(project.branches.integration).toBe('backlog');
  });

  it('names a release with the project’s word', () => {
    expect(releaseName('0.2.0')).toBe('Génération 0.2');
    expect(releaseName('v0.2.1')).toBe('Génération 0.2.1');
    expect(releaseName(null)).toBe('Prochaine génération');
  });

  it('gives the paths of the brief and of ask.mjs from the root of the checkout', () => {
    expect(briefPath).toMatch(/(^|\/)agent\/brief\.md$/);
    expect(askPath).toMatch(/(^|\/)agent\/ask\.mjs$/);
  });

  it('fills the pages and scripts of the dashboard with the project’s words', () => {
    const page = renderPage('<head><title>Agents __PROJECT__</title></head><p>__INTEGRATION__ · __Release__ · __CHANGES__</p>');
    expect(page).toContain('<title>Agents Jeu de test</title>');
    expect(page).toContain('<p>backlog · Génération · changes</p>');
    expect(page).toContain('<script>window.PROJECT = {');
    expect(renderText("confirm(`Publier la __RELEASE__ ?`)")).toBe('confirm(`Publier la génération ?`)');
    expect(clientSettings()).toMatchObject({ name: 'Jeu de test', release: { Word: 'Génération' } });
    expect(clientSettings()).toMatchObject({ efforts: ['low', 'medium', 'high', 'xhigh', 'max'], defaults: { effort: null, model: null }, models: ['opus', 'sonnet', 'fable', 'haiku'] });
  });

  it('hands agent.sh its variables, quoted for the shell', () => {
    const out = shellVariables();
    expect(out).toContain("SERVER_COMMAND='npm run dev:server'");
    expect(out).toContain("SERVER_PORT_BASE='7800'");
    expect(out).toContain('SEED_SQLITE=()');
    const printed = execFileSync('bash', ['-c', `eval "$(node '${join(here, '../config.mjs')}' shell)"; echo "$PROJECT_NAME|\${#SEED_COPY[@]}"`], { encoding: 'utf8' });
    expect(printed.trim()).toBe('Jeu de test|0');
  });
});

describe('the example of agents.config.mjs', () => {
  it('draws its game inside the map, apart from the framework’s nodes, and closes the cycle', () => {
    const settings = merge(DEFAULTS, example);
    const { zones, nodes, flows } = buildMap(settings.hub);
    for (const node of nodes) {
      const [x, y, w, h] = zones.find((zone) => zone.id === node.zone)!.box;
      expect(node.x >= x && node.y >= y && node.x + NODE_SIZE.w <= x + w && node.y + NODE_SIZE.h <= y + h, node.id).toBe(true);
    }
    const overlap = (a: number[], b: number[]) => a[0]! < b[0]! + b[2]! && b[0]! < a[0]! + a[2]! && a[1]! < b[1]! + b[3]! && b[1]! < a[1]! + a[3]!;
    const boxes = zones.map((zone) => zone.box);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i]!, boxes[j]!)).toBe(false);
    for (const [x, y, w, h] of boxes) expect(x! + w! <= MAP_SIZE.width && y! + h! <= MAP_SIZE.height).toBe(true);
    expect(flows.filter((flow) => !flow.side).at(-1)!.to).toBe('roadmap');
    expect(hubMap({ zones, nodes, flows }, settings.hub).flows.every((flow) => flow.d.startsWith('M'))).toBe(true);
  });
});
