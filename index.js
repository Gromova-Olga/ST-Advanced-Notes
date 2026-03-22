import { extension_settings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

const extensionName = "ST-Advanced-Notes";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

const defaultSettings = {
    tree: [],
    activeFileId: null,
    window: { top: 80, left: 200, width: 700, height: 500 },
    fab: { top: 400, left: window.innerWidth - 80 },
    sidebarWidth: 200
};

let state = null;
let activeFileId = null;
let fabDragged = false;

const FOLDER_COLORS = [
    { label: "Обычный",    value: null },
    { label: "Красный",    value: "#e05555" },
    { label: "Оранжевый",  value: "#e08c3a" },
    { label: "Жёлтый",    value: "#d4c244" },
    { label: "Зелёный",   value: "#4caf6e" },
    { label: "Голубой",   value: "#4aa8d8" },
    { label: "Синий",     value: "#5566dd" },
    { label: "Фиолетовый",value: "#9c5cd4" },
    { label: "Розовый",   value: "#d45c9c" },
    { label: "Серый",     value: "#888888" },
];

const FOLDER_ICONS = [
    "📁","📂","🗂️","📚","📖","📝","📌","📎",
    "⭐","❤️","🔥","💡","🎯","🎨","🔒","🗃️",
    "🧩","🎭","🌟","💎"
];

// ===== INIT =====
jQuery(async () => {
    console.log(`[${extensionName}] Loading...`);
    try {
        const settingsHtml = await $.get(`${extensionFolderPath}/example.html`);
        $("#extensions_settings2").append(settingsHtml);

        const appHtml = await $.get(`${extensionFolderPath}/app.html`);
        $("body").append(appHtml);

        loadState();
        applyWindowGeometry();

        $("#rn-open-btn").on("click", toggleApp);
        $("#rn-close").on("click", () => {
            saveWindowGeometry();
            $("#rn-app").hide();
        });
        // Прозрачность окна
const savedOpacity = state.windowOpacity || 100;
$("#rn-opacity-slider").val(savedOpacity);
applyOpacity(savedOpacity);

$("#rn-opacity-slider").on("input", function() {
    const val = parseInt(this.value);
    applyOpacity(val);
    state.windowOpacity = val;
    saveState();
});
        // Скрытие сайдбара
        $("#rn-toggle-sidebar").on("click", toggleSidebar);

        makeDraggable($("#rn-app"), $("#rn-titlebar"), onWindowDragEnd);
        makeDraggable($("#rn-fab"), $("#rn-fab"), onFabDragEnd, true);
        makeSidebarResize();
        watchWindowResize();

        $("#rn-new-folder").on("click", createFolder);
        $("#rn-new-file").on("click", createRootFile);

        initToolbar();
        initFolderPopover();
        renderTree();
        initTreeDragDrop();

        // Восстанавливаем последний открытый файл
        if (state.activeFileId) {
            const lastFile = findById(state.tree, state.activeFileId);
            if (lastFile) openFile(state.activeFileId);
        }

        // Экспорт
        $("#rn-export-btn").on("click", exportCurrentFile);

        $(document).on("click.rn-popover", (e) => {
            if (!$(e.target).closest("#rn-folder-popover, .rn-act-style").length) {
                $("#rn-folder-popover").hide();
            }
        });

        console.log(`[${extensionName}] ✅ Loaded successfully`);
    } catch (error) {
        console.error(`[${extensionName}] ❌ Failed to load:`, error);
    }
}); 

// ===== STATE =====
function loadState() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    const s = extension_settings[extensionName];
    if (!s.tree)   s.tree = [];
    if (!s.window) s.window = { ...defaultSettings.window };
    
    // ЖЕСТКИЙ СБРОС КООРДИНАТ КНОПКИ
    // Если координат нет, они сломаны, или это не числа (например NaN) — пересоздаем дефолтные
    if (!s.fab || typeof s.fab.top !== 'number' || typeof s.fab.left !== 'number' || isNaN(s.fab.top) || isNaN(s.fab.left)) {
        s.fab = { 
            top: window.innerHeight / 2, // по центру высоты
            left: window.innerWidth - 80 // справа
        };
    }
    
    if (s.sidebarWidth === undefined) s.sidebarWidth = 200;
    state = s;
}

// ===== GEOMETRY =====
function applyWindowGeometry() {
    const w = state.window;
    $("#rn-app").css({
        top:    w.top,
        left:   w.left,
        width:  w.width,
        height: w.height
    });

    // Берем проверенные координаты
    let fTop = Number(state.fab.top) || (window.innerHeight / 2);
    let fLeft = Number(state.fab.left) || (window.innerWidth - 80);

    const maxLeft = window.innerWidth - 60;
    const maxTop = window.innerHeight - 60;

    // Последняя линия обороны от выхода за экран
    if (fLeft > maxLeft) fLeft = maxLeft - 20;
    if (fTop > maxTop) fTop = maxTop - 20;
    if (fLeft < 0) fLeft = 20;
    if (fTop < 0) fTop = 20;

    // Принудительно ставим display: flex и огромный z-index, чтобы Таверна не перекрывала
    $("#rn-fab").css({
        top:    fTop + "px",
        left:   fLeft + "px",
        bottom: "auto",
        right:  "auto",
        display: "flex",
        zIndex: 99999 
    });

    $("#rn-sidebar").css("width", state.sidebarWidth + "px");
}
function applyOpacity(val) {
    const opacity = val / 100;
    // Меняем только фон, а не весь элемент включая текст
    const base = `rgba(26, 26, 46, ${opacity})`;
    $("#rn-app").css("background", base);
    // Также titlebar и toolbar
    $("#rn-titlebar").css("background", `rgba(255,255,255,${opacity * 0.05})`);
    $("#rn-toolbar").css("background", `rgba(255,255,255,${opacity * 0.03})`);
}

function saveWindowGeometry() {
    const $app = $("#rn-app");
    state.window = {
        top:    parseInt($app.css("top"))    || 80,
        left:   parseInt($app.css("left"))   || 200,
        width:  $app.outerWidth()            || 700,
        height: $app.outerHeight()           || 500
    };
    saveState();
}

function onWindowDragEnd() {
    saveWindowGeometry();
}

function onFabDragEnd() {
    const $fab = $("#rn-fab");
    state.fab = {
        top:  parseInt($fab.css("top"))  || 0,
        left: parseInt($fab.css("left")) || 0
    };
    saveState();
    fabDragged = true; // помечаем что было перетаскивание
    setTimeout(() => { fabDragged = false; }, 100);
}

// Следим за resize окна через ResizeObserver
function watchWindowResize() {
    const appEl = document.getElementById("rn-app");
    if (!appEl || !window.ResizeObserver) return;

    let resizeTimer;
    const observer = new ResizeObserver(() => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            saveWindowGeometry();
        }, 300);
    });
    observer.observe(appEl);
}

// ===== TREE HELPERS =====
function findById(tree, id) {
    for (const node of tree) {
        if (node.id === id) return node;
        if (node.children) {
            const found = findById(node.children, id);
            if (found) return found;
        }
    }
    return null;
}

function removeById(tree, id) {
    for (let i = 0; i < tree.length; i++) {
        if (tree[i].id === id) { tree.splice(i, 1); return true; }
        if (tree[i].children && removeById(tree[i].children, id)) return true;
    }
    return false;
}

// ===== CREATE =====
function createFolder() {
    const name = prompt("Название папки:", "Новая папка");
    if (!name) return;
    state.tree.push({ id: genId(), type: "folder", name, expanded: true, children: [], color: null, icon: "📁" });
    saveState(); renderTree();
}

function createRootFile() {
    const name = prompt("Название файла:", "Новый файл");
    if (!name) return;
    state.tree.push({ id: genId(), type: "file", name, content: "" });
    saveState(); renderTree();
}

function createFileInFolder(folderId) {
    const name = prompt("Название файла:", "Новый файл");
    if (!name) return;
    const folder = findById(state.tree, folderId);
    if (!folder) return;
    folder.children.push({ id: genId(), type: "file", name, content: "" });
    saveState(); renderTree();
}

function createSubfolder(parentId) {
    const name = prompt("Название папки:", "Новая папка");
    if (!name) return;
    const parent = findById(state.tree, parentId);
    if (!parent) return;
    parent.children.push({ id: genId(), type: "folder", name, expanded: true, children: [], color: null, icon: "📁" });
    saveState(); renderTree();
}

// ===== RENAME / DELETE =====
function renameNode(id) {
    const node = findById(state.tree, id);
    if (!node) return;
    const newName = prompt("Новое название:", node.name);
    if (!newName || newName === node.name) return;
    node.name = newName;
    saveState(); renderTree();
    if (activeFileId === id) $("#rn-editor-filename").text("📄 " + newName);
}

function deleteNode(id) {
    const node = findById(state.tree, id);
    if (!node) return;
    const label = node.type === "folder"
        ? `папку "${node.name}" и всё содержимое`
        : `файл "${node.name}"`;
    if (!confirm(`Удалить ${label}?`)) return;
    if (activeFileId === id || isChildActive(node)) { activeFileId = null; state.activeFileId = null; showPlaceholder(); }
    removeById(state.tree, id);
    saveState(); renderTree();
}

function isChildActive(node) {
    if (!node.children) return false;
    for (const child of node.children) {
        if (child.id === activeFileId) return true;
        if (isChildActive(child)) return true;
    }
    return false;
}

// ===== FOLDER STYLE POPOVER =====
function initFolderPopover() {
    const $colors = $("#rn-pop-colors");
    const $icons  = $("#rn-pop-icons");

    FOLDER_COLORS.forEach(c => {
        const $s = $(`<div class="rn-swatch rn-color-swatch" title="${c.label}"></div>`);
        c.value ? $s.css("background", c.value) : $s.addClass("rn-swatch-none").text("✕");
        $s.on("click", () => {
            const node = findById(state.tree, $("#rn-folder-popover").data("folderId"));
            if (node) { node.color = c.value; saveState(); renderTree(); }
            $("#rn-folder-popover").hide();
        });
        $colors.append($s);
    });

    FOLDER_ICONS.forEach(icon => {
        const $s = $(`<div class="rn-swatch rn-icon-swatch">${icon}</div>`);
        $s.on("click", () => {
            const node = findById(state.tree, $("#rn-folder-popover").data("folderId"));
            if (node) { node.icon = icon; saveState(); renderTree(); }
            $("#rn-folder-popover").hide();
        });
        $icons.append($s);
    });
}

function openFolderPopover(folderId, $anchor) {
    const $pop = $("#rn-folder-popover");
    $pop.data("folderId", folderId);
    const offset = $anchor.offset();
    $pop.css({
        top:  offset.top + $anchor.outerHeight() + 4,
        left: Math.min(offset.left, $(window).width() - 220)
    }).show();
}

// ===== TOGGLE FOLDER =====
function toggleFolder(id) {
    const node = findById(state.tree, id);
    if (!node) return;
    node.expanded = !node.expanded;
    saveState(); renderTree();
}

// ===== OPEN FILE =====
function openFile(id) {
    if (activeFileId) {
        const current = findById(state.tree, activeFileId);
        if (current) current.content = $("#rn-editor").html();
        saveState();
    }
    activeFileId = id;
    state.activeFileId = id; // запоминаем последний открытый
    const node = findById(state.tree, id);
    if (!node) return;
    $("#rn-editor-placeholder").hide();
    $("#rn-editor-area").show();
    $("#rn-toolbar").css("visibility", "visible");
    $("#rn-filename-text").text("📄 " + node.name);
    $("#rn-editor").html(node.content || "");
    $("#rn-editor").focus();
    renderTree();
    saveState();
}

function showPlaceholder() {
    $("#rn-editor-area").hide();
    $("#rn-editor-placeholder").show();
    $("#rn-toolbar").css("visibility", "hidden");
}

function exportCurrentFile() {
    if (!activeFileId) return;
    const node = findById(state.tree, activeFileId);
    if (!node) return;

    // Берём чистый текст без HTML-тегов
    const text = $("#rn-editor")[0].innerText;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url  = URL.createObjectURL(blob);

    const $a = $("<a>").attr({ href: url, download: node.name + ".txt" });
    $("body").append($a);
    $a[0].click();
    $a.remove();
    URL.revokeObjectURL(url);

    toastr.success(`Файл "${node.name}.txt" сохранён`, "Rich Notepad");
}

// ===== AUTO-SAVE EDITOR =====
$(document).on("input", "#rn-editor", () => {
    if (!activeFileId) return;
    const node = findById(state.tree, activeFileId);
    if (node) node.content = $("#rn-editor").html();
    saveState();
});

// ===== TOOLBAR =====
function initToolbar() {
    $("#rn-toolbar").css("visibility", "hidden");

    $(".rn-tb-btn[data-cmd]").on("click", function () {
        $("#rn-editor").focus();
        document.execCommand($(this).data("cmd"), false, null);
        updateToolbarState();
    });

    $("#rn-color-text").on("input", function () {
        $("#rn-editor").focus();
        document.execCommand("foreColor", false, this.value);
    });

    $("#rn-color-bg").on("input", function () {
        $("#rn-editor").focus();
        document.execCommand("hiliteColor", false, this.value);
    });

    $(document).on("paste", "#rn-editor", function(e) {
        e.preventDefault();
    // Достаем только чистый текст из буфера обмена
        const text = (e.originalEvent || e).clipboardData.getData("text/plain");
    // Вставляем его системной командой, чтобы сработал undo/redo
        document.execCommand("insertText", false, text);
    });

    // Сброс фона текста
    $("#rn-clear-bg").on("click", () => {
        $("#rn-editor").focus();
    // Убираем фон через transparent
        document.execCommand("hiliteColor", false, "transparent");
    });

    $("#rn-font-size").on("change", function () {
        $("#rn-editor").focus();
        document.execCommand("fontSize", false, this.value);
    });

    $(document).on("mouseup keyup", "#rn-editor", updateToolbarState);
}

function updateToolbarState() {
    ["bold","italic","underline","strikeThrough","insertUnorderedList","insertOrderedList"].forEach(cmd => {
        $(`.rn-tb-btn[data-cmd="${cmd}"]`).toggleClass("rn-tb-active", document.queryCommandState(cmd));
    });
}

// ===== DRAG & DROP TREE =====
let dragNode = null;

function findParentArray(tree, id) {
    for (let i = 0; i < tree.length; i++) {
        if (tree[i].id === id) return { arr: tree, index: i };
        if (tree[i].children) {
            const found = findParentArray(tree[i].children, id);
            if (found) return found;
        }
    }
    return null;
}

function initTreeDragDrop() {
    const $tree = $("#rn-tree");
    // Отвязываем старые события, чтобы не дублировать
    $tree.off("dragstart dragend dragover dragleave drop touchstart");
    $(document).off(".rn-tree-touch"); 

    // ===== 1. DESKTOP (Native HTML5) =====
    $tree.on("dragstart", ".rn-folder[draggable], .rn-file[draggable]", function(e) {
        e.stopPropagation();
        dragNode = findById(state.tree, $(this).data("id"));
        if (!dragNode) return;
        e.originalEvent.dataTransfer.effectAllowed = "move";
        e.originalEvent.dataTransfer.setData("text/plain", dragNode.id);
        setTimeout(() => $(this).addClass("rn-drag-source"), 0);
    });

    $tree.on("dragend", function() {
        $(".rn-drag-source").removeClass("rn-drag-source");
        $(".rn-drag-over").removeClass("rn-drag-over");
        $tree.removeClass("rn-drag-over-root");
        dragNode = null;
    });

    $tree.on("dragover", function(e) {
        e.preventDefault();
        e.originalEvent.dataTransfer.dropEffect = "move";
        const $target = $(e.target).closest(".rn-folder[draggable], .rn-file[draggable]");
        $(".rn-drag-over").removeClass("rn-drag-over");
        
        if ($target.length) {
            $tree.removeClass("rn-drag-over-root");
            $target.addClass("rn-drag-over");
        } else {
            $tree.addClass("rn-drag-over-root");
        }
    });

    $tree.on("dragleave", function(e) {
        if (!$(e.relatedTarget).closest("#rn-tree").length) {
            $(".rn-drag-over").removeClass("rn-drag-over");
            $tree.removeClass("rn-drag-over-root");
        }
    });

    $tree.on("drop", function(e) {
        e.stopPropagation();
        e.preventDefault();
        $(".rn-drag-over").removeClass("rn-drag-over");
        $tree.removeClass("rn-drag-over-root");

        if (!dragNode) return;
        const $target = $(e.target).closest(".rn-folder[draggable], .rn-file[draggable]");
        processDrop($target.length ? $target.data("id") : null, true);
    });

    // ===== 2. MOBILE (Touch Events) =====
    let touchTimer = null;
    let isTouchDragging = false;
    let $touchGhost = null;

    $tree.on("touchstart", ".rn-folder, .rn-file", function(e) {
        // Игнорируем тапы по кнопкам действий и стрелкам
        if ($(e.target).closest(".rn-act, .rn-arrow").length) return;
        
        const touch = e.originalEvent.touches[0];
        const $nodeEl = $(this);
        const targetId = $nodeEl.data("id");

        // Запускаем таймер долгого нажатия
        touchTimer = setTimeout(() => {
            isTouchDragging = true;
            dragNode = findById(state.tree, targetId);
            $nodeEl.addClass("rn-drag-source");
            
            // Создаем визуального "призрака" для пальца
            $touchGhost = $nodeEl.clone().css({
                position: "fixed",
                top: touch.clientY - 15,
                left: touch.clientX - 15,
                width: $nodeEl.width(),
                opacity: 0.8,
                zIndex: 11000,
                pointerEvents: "none",
                background: "var(--SmartThemeBlurTintColor, #1a1a2e)",
                border: "1px solid var(--SmartThemeBorderColor, #555)",
                borderRadius: "4px"
            }).appendTo("body");
            
            if (navigator.vibrate) navigator.vibrate(40); // Легкий виброотклик
        }, 400); // 400мс удержание
    });

    $(document).on("touchmove.rn-tree-touch", function(e) {
        if (!isTouchDragging) {
            clearTimeout(touchTimer); // Отменяем таймер, если палец сдвинулся (это скролл)
            return;
        }
        e.preventDefault(); // Запрещаем скролл экрана при перетаскивании
        
        const touch = e.originalEvent.touches[0];
        $touchGhost.css({ top: touch.clientY - 15, left: touch.clientX - 15 });

        // Ищем элемент под пальцем (прячем призрака на миллисекунду, чтобы он не перекрывал)
        $touchGhost.hide();
        const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
        $touchGhost.show();

        $(".rn-drag-over").removeClass("rn-drag-over");
        $tree.removeClass("rn-drag-over-root");

        if (!elemBelow) return;

        const $dropTarget = $(elemBelow).closest(".rn-folder, .rn-file");
        if ($dropTarget.length && $dropTarget.closest("#rn-tree").length) {
            $dropTarget.addClass("rn-drag-over");
        } else if ($(elemBelow).closest("#rn-tree").length) {
            $tree.addClass("rn-drag-over-root");
        }
    });

    $(document).on("touchend.rn-tree-touch touchcancel.rn-tree-touch", function(e) {
        clearTimeout(touchTimer);
        if (!isTouchDragging) return;
        isTouchDragging = false;

        if ($touchGhost) { $touchGhost.remove(); $touchGhost = null; }

        const touch = e.originalEvent.changedTouches[0];
        const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);

        $(".rn-drag-over").removeClass("rn-drag-over");
        $tree.removeClass("rn-drag-over-root");
        $(".rn-drag-source").removeClass("rn-drag-source");

        if (!dragNode || !elemBelow) { dragNode = null; return; }

        const $dropTarget = $(elemBelow).closest(".rn-folder, .rn-file");
        const isInsideTree = $(elemBelow).closest("#rn-tree").length > 0;

        // Передаем логику в общую функцию
        if ($dropTarget.length) {
            processDrop($dropTarget.data("id"), false);
        } else if (isInsideTree) {
            processDrop(null, true);
        } else {
            dragNode = null;
        }
    });
}

function isDescendant(node, targetId) {
    if (!node.children) return false;
    for (const child of node.children) {
        if (child.id === targetId) return true;
        if (isDescendant(child, targetId)) return true;
    }
    return false;
}

// Общая логика изменения state (для ПК и Mobile)
function processDrop(targetId, isRootDrop) {
    if (!dragNode) return;

    if (targetId) {
        const targetNode = findById(state.tree, targetId);
        if (!targetNode || targetNode.id === dragNode.id) { dragNode = null; return; }
        if (isDescendant(dragNode, targetNode.id)) { dragNode = null; return; }

        const src = findParentArray(state.tree, dragNode.id);
        if (!src) { dragNode = null; return; }
        src.arr.splice(src.index, 1);

        if (targetNode.type === "folder") {
            targetNode.children = targetNode.children || [];
            targetNode.children.unshift(dragNode);
            targetNode.expanded = true;
        } else {
            const dest = findParentArray(state.tree, targetId);
            if (!dest) { dragNode = null; return; }
            dest.arr.splice(dest.index + 1, 0, dragNode);
        }
    } else if (isRootDrop) {
        const src = findParentArray(state.tree, dragNode.id);
        if (!src) { dragNode = null; return; }
        src.arr.splice(src.index, 1);
        state.tree.push(dragNode);
    }

    dragNode = null;
    saveState();
    renderTree();
    initTreeDragDrop(); // Перевешиваем события
}

function isDescendant(node, targetId) {
    if (!node.children) return false;
    for (const child of node.children) {
        if (child.id === targetId) return true;
        if (isDescendant(child, targetId)) return true;
    }
    return false;
}

// ===== RENDER TREE =====
function renderTree() {
    const $tree = $("#rn-tree");
    $tree.empty();
    if (state.tree.length === 0) {
        $tree.append('<div class="rn-empty-hint">Нажмите 📁+ для папки<br>или 📄+ для файла</div>');
        return;
    }
    renderNodes(state.tree, $tree, 0);
}

function renderNodes(nodes, $container, depth) {
    for (const node of nodes) {
        $container.append(node.type === "folder" ? renderFolder(node, depth) : renderFile(node, depth));
    }
}

function renderFolder(node, depth) {
    const arrow = node.expanded ? "▼" : "▶";
    const icon  = node.icon || "📁";
    const colorStyle = node.color ? `color:${node.color};` : "";

    const $folder = $(`
        <div class="rn-folder" data-id="${node.id}" draggable="true">
            <div class="rn-folder-row" style="padding-left:${depth * 14 + 6}px">
                <span class="rn-arrow">${arrow}</span>
                <span class="rn-folder-icon" style="${colorStyle}">${icon}</span>
                <span class="rn-node-name" style="${colorStyle}">${escHtml(node.name)}</span>
                <span class="rn-node-actions">
                    <button class="rn-act rn-act-style" data-action="style"     data-id="${node.id}" title="Цвет и иконка">🎨</button>
                    <button class="rn-act"              data-action="newfile"   data-id="${node.id}" title="Новый файл">📄+</button>
                    <button class="rn-act"              data-action="newfolder" data-id="${node.id}" title="Новая папка">📁+</button>
                    <button class="rn-act"              data-action="rename"    data-id="${node.id}" title="Переименовать">✏️</button>
                    <button class="rn-act"              data-action="delete"    data-id="${node.id}" title="Удалить">🗑️</button>
                </span>
            </div>
        </div>
    `);

    $folder.find(".rn-folder-row").on("click", (e) => {
        if ($(e.target).closest(".rn-act").length) return;
        toggleFolder(node.id);
    });

    if (node.expanded && node.children?.length > 0) {
        const $children = $('<div class="rn-children"></div>');
        renderNodes(node.children, $children, depth + 1);
        $folder.append($children);
    }

    return $folder;
}

function renderFile(node, depth) {
    const isActive = node.id === activeFileId;
    const $file = $(`
        <div class="rn-file ${isActive ? "rn-file-active" : ""}" data-id="${node.id}" draggable="true" style="padding-left:${depth * 14 + 24}px">
            <span class="rn-file-icon">📄</span>
            <span class="rn-node-name">${escHtml(node.name)}</span>
            <span class="rn-node-actions">
                <button class="rn-act" data-action="rename" data-id="${node.id}" title="Переименовать">✏️</button>
                <button class="rn-act" data-action="delete" data-id="${node.id}" title="Удалить">🗑️</button>
            </span>
        </div>
    `);

    $file.on("click", (e) => {
        if ($(e.target).closest(".rn-act").length) return;
        openFile(node.id);
    });

    return $file;
}

// ===== ACTION DELEGATION =====
$(document).on("click", ".rn-act", function (e) {
    e.stopPropagation();
    const action = $(this).data("action");
    const id     = $(this).data("id");
    if      (action === "style")     openFolderPopover(id, $(this));
    else if (action === "newfile")   createFileInFolder(id);
    else if (action === "newfolder") createSubfolder(id);
    else if (action === "rename")    renameNode(id);
    else if (action === "delete")    deleteNode(id);
});

// ===== UTILS =====
function escHtml(str) {
    return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function toggleApp() {
    if (fabDragged) return; // игнорируем если только что тащили
    const $app = $("#rn-app");
    if ($app.is(":visible")) {
        saveWindowGeometry();
        $app.hide();
    } else {
        $app.show();
    }
}

function toggleSidebar() {
    const $sidebar = $("#rn-sidebar");
    const $divider = $("#rn-divider");
    const $btn = $("#rn-toggle-sidebar");
    const $overlay = $("#rn-sidebar-overlay");
    const isMobile = window.innerWidth <= 600;
    const isHidden = $sidebar.data("hidden") === true;

    if (isHidden) {
        if (isMobile) {
            $sidebar.attr("data-hidden", "false").data("hidden", false);
            $overlay.addClass("active");
        } else {
            $sidebar.show();
            $divider.show();
        }
        $btn.text("◀");
        $sidebar.data("hidden", false);
    } else {
        if (isMobile) {
            $sidebar.attr("data-hidden", "true").data("hidden", true);
            $overlay.removeClass("active");
        } else {
            $sidebar.hide();
            $divider.hide();
        }
        $btn.text("▶");
        $sidebar.data("hidden", true);
    }
}

// Закрываем сайдбар тапом по затемнению
$(document).on("click", "#rn-sidebar-overlay", () => {
    const $sidebar = $("#rn-sidebar");
    if (!$sidebar.data("hidden")) toggleSidebar();
});

function makeDraggable($element, $handle, onEnd, isFab = false) {
    let isDragging = false;
    let hasMoved = false;
    let startX, startY, origLeft, origTop;

    $handle.on("mousedown touchstart", (e) => {
        if ($(e.target).closest("button, input, select, .rn-icon-btn, .rn-act, #rn-editor, #rn-editor-panel, #rn-main, #rn-sidebar").length) return;
        if (e.type === "mousedown" && e.button !== 0) return;

        isDragging = true;
        hasMoved = false;
        
        const evt = e.type === "touchstart" ? e.originalEvent.touches[0] : e;
        startX = evt.clientX; 
        startY = evt.clientY;
        
        // Надежно берем текущие координаты, даже если в CSS прописано right/bottom
        const offset = $element.offset();
        origLeft = offset.left - $(window).scrollLeft();
        origTop  = offset.top - $(window).scrollTop();
    });

    $(document).on("mousemove.rn-drag touchmove.rn-drag", (e) => {
        if (!isDragging) return;
        const evt = e.type === "touchmove" ? e.originalEvent.touches[0] : e;
        
        const dx = evt.clientX - startX;
        const dy = evt.clientY - startY;
        if (!hasMoved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
        
        hasMoved = true;
        if (e.type === "touchmove") e.preventDefault(); // Блокируем скролл страницы на мобилке
        
        let newLeft = origLeft + dx;
        let newTop = origTop + dy;
        
        // Ограничиваем перетаскивание FAB рамками экрана
        if (isFab) {
            const maxLeft = window.innerWidth - $element.outerWidth();
            const maxTop = window.innerHeight - $element.outerHeight();
            newLeft = Math.max(0, Math.min(newLeft, maxLeft));
            newTop = Math.max(0, Math.min(newTop, maxTop));
        }
        
        $element.css({ left: newLeft, top: newTop, bottom: 'auto', right: 'auto' });
    });

    $(document).on("mouseup.rn-drag touchend.rn-drag", (e) => {
        if (!isDragging) return;
        const moved = hasMoved;
        isDragging = false;

        if (moved) {
            if (onEnd) onEnd();
        } else if (isFab) {
            toggleApp(); // Если это был просто тап/клик, открываем блокнот
            if (e.type === "touchend") e.preventDefault(); 
        }
        hasMoved = false;
    });
}

function makeSidebarResize() {
    const $divider = $("#rn-divider");
    const $sidebar = $("#rn-sidebar");
    let isResizing = false, startX, startWidth;
    
    $divider.on("mousedown touchstart", (e) => {
        isResizing = true; 
        const evt = e.type === "touchstart" ? e.originalEvent.touches[0] : e;
        startX = evt.clientX; 
        startWidth = $sidebar.width();
        if (e.type === "touchstart") e.preventDefault();
    });
    
    $(document).on("mousemove.rn-resize touchmove.rn-resize", (e) => {
        if (!isResizing) return;
        const evt = e.type === "touchmove" ? e.originalEvent.touches[0] : e;
        const w = Math.max(120, Math.min(350, startWidth + (evt.clientX - startX)));
        $sidebar.css("width", w + "px");
        state.sidebarWidth = w;
    });
    
    $(document).on("mouseup.rn-resize touchend.rn-resize", () => {
        if (isResizing) saveState();
        isResizing = false;
    });
}
