# Search and export drill detail

The drill detail dialog offers a field selector and a search box for text columns. Submit a keyword to search all pages within the current drill scope. Search conditions belong to the dialog: they do not update dashboard filters. Clearing the keyword restores the original drill scope, including chart, dashboard, and clicked-value filters.

CSV and Excel exports contain detail rows matching the applied search and drill filters, beginning at the first row rather than the visible page. Export uses the chart data API and its existing dataset, dashboard, row-level, and `can_csv` permission checks. Users without export permission do not see export buttons. When matches exceed `SQL_MAX_ROW`, the dialog displays the export limit and asks the user to narrow the search.

Submitting a search or changing the page size returns to page one. Searches with no matches keep the search box available so the keyword can be cleared. Requests superseded by a later search or page change cannot replace the displayed results.
