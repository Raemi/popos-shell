import * as Geom from './geom.js';

import type { ShellWindow } from './window.js';
import type { Ext } from './extension.js';

export enum FocusPosition {
    TopLeft = 'Top Left',
    TopRight = 'Top Right',
    BottomLeft = 'Bottom Left',
    BottomRight = 'Bottom Right',
    Center = 'Center',
}

export class FocusSelector {
    private select(
        ext: Ext,
        direction: (a: ShellWindow, b: Array<ShellWindow>) => Array<ShellWindow>,
        window: ShellWindow | null,
        predicate?: (focused: ShellWindow, candidate: ShellWindow) => boolean,
    ): ShellWindow | null {
        const focused = window ?? ext.focus_window();
        if (focused) {
            let window_list = ext.active_window_list();
            if (predicate) {
                window_list = window_list.filter((candidate) => predicate(focused, candidate));
            }

            return select(direction, focused, window_list);
        }

        return null;
    }

    private static same_monitor_workspace(focused: ShellWindow, candidate: ShellWindow): boolean {
        return (
            candidate.entity !== focused.entity &&
            candidate.meta.get_monitor() === focused.meta.get_monitor() &&
            candidate.workspace_id() === focused.workspace_id()
        );
    }

    down(ext: Ext, window: ShellWindow | null): ShellWindow | null {
        return this.select(ext, window_down, window);
    }

    down_monitor(ext: Ext, window: ShellWindow | null): ShellWindow | null {
        return this.select(ext, window_down, window, FocusSelector.same_monitor_workspace);
    }

    left(ext: Ext, window: ShellWindow | null): ShellWindow | null {
        return this.select(ext, window_left, window);
    }

    left_monitor(ext: Ext, window: ShellWindow | null): ShellWindow | null {
        return this.select(ext, window_left, window, FocusSelector.same_monitor_workspace);
    }

    right(ext: Ext, window: ShellWindow | null): ShellWindow | null {
        return this.select(ext, window_right, window);
    }

    right_monitor(ext: Ext, window: ShellWindow | null): ShellWindow | null {
        return this.select(ext, window_right, window, FocusSelector.same_monitor_workspace);
    }

    up(ext: Ext, window: ShellWindow | null): ShellWindow | null {
        return this.select(ext, window_up, window);
    }

    up_monitor(ext: Ext, window: ShellWindow | null): ShellWindow | null {
        return this.select(ext, window_up, window, FocusSelector.same_monitor_workspace);
    }
}

function select(
    windows: (a: ShellWindow, b: Array<ShellWindow>) => Array<ShellWindow>,
    focused: ShellWindow,
    window_list: Array<ShellWindow>,
): ShellWindow | null {
    const array = windows(focused, window_list);
    return array.length > 0 ? array[0] : null;
}

function window_down(focused: ShellWindow, windows: Array<ShellWindow>) {
    return windows
        .filter((win) => !win.meta.minimized && win.meta.get_frame_rect().y > focused.meta.get_frame_rect().y)
        .sort((a, b) => Geom.downward_distance(a.meta, focused.meta) - Geom.downward_distance(b.meta, focused.meta));
}

function window_left(focused: ShellWindow, windows: Array<ShellWindow>) {
    return windows
        .filter((win) => !win.meta.minimized && win.meta.get_frame_rect().x < focused.meta.get_frame_rect().x)
        .sort((a, b) => Geom.leftward_distance(a.meta, focused.meta) - Geom.leftward_distance(b.meta, focused.meta));
}

function window_right(focused: ShellWindow, windows: Array<ShellWindow>) {
    return windows
        .filter((win) => !win.meta.minimized && win.meta.get_frame_rect().x > focused.meta.get_frame_rect().x)
        .sort((a, b) => Geom.rightward_distance(a.meta, focused.meta) - Geom.rightward_distance(b.meta, focused.meta));
}

function window_up(focused: ShellWindow, windows: Array<ShellWindow>) {
    return windows
        .filter((win) => !win.meta.minimized && win.meta.get_frame_rect().y < focused.meta.get_frame_rect().y)
        .sort((a, b) => Geom.upward_distance(a.meta, focused.meta) - Geom.upward_distance(b.meta, focused.meta));
}
