# Backend modules

Shared helper modules in `backend/src/` and what each one exports. Route files are listed separately in [API routes](API_ROUTES.md).

## `src/catalog.js`
Menu catalogue: image for every item (served locally from frontend/images/food, so nothing is loaded from the internet) and the extra items added in v2.

Exports: `IMAGE_BY_NAME`, `NEW_ITEMS`, `NUTRITION_BY_NAME`, `nutritionFor`, `RESTAURANTS`, `DEFAULT_RESTAURANT`, `ITEMS_BY_RESTAURANT`, `restaurantOf`, `isRestaurantId`, `menuRank`
