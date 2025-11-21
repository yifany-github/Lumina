export const getTree = async () => {
    return new Promise((resolve) => {
        chrome.bookmarks.getTree((tree) => {
            resolve(tree);
        });
    });
};

export const flattenBookmarks = (nodes) => {
    let bookmarks = [];
    for (const node of nodes) {
        if (node.url) {
            bookmarks.push({
                id: node.id,
                title: node.title,
                url: node.url,
                dateAdded: node.dateAdded,
            });
        }
        if (node.children) {
            bookmarks = bookmarks.concat(flattenBookmarks(node.children));
        }
    }
    return bookmarks;
};

export const searchBookmarks = async (query) => {
    return new Promise((resolve) => {
        chrome.bookmarks.search(query, (results) => {
            resolve(results);
        });
    });
};
