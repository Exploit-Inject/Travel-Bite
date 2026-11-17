"use client";
import { useMemo, useState } from "react";
import {
  ArrowDownUp,
  ArrowRight,
  Check,
  ChefHat,
  Clock3,
  Coffee,
  Heart,
  Leaf,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useApp } from "./app-provider";
import { Quantity } from "./bag";
import { money, type Category, type Food } from "@/lib/types";
const categories: { name: Category; icon: typeof UtensilsCrossed }[] = [
  { name: "All", icon: UtensilsCrossed },
  { name: "Meals", icon: ChefHat },
  { name: "Biryani", icon: Sparkles },
  { name: "Snacks", icon: UtensilsCrossed },
  { name: "South Indian", icon: ChefHat },
  { name: "Beverages", icon: Coffee },
];
export function FoodCard({ food }: { food: Food }) {
  const { catalog, cart, addItem, favourites, toggleFavourite } = useApp();
  const restaurant = catalog.restaurants.find(
    (r) => r._id === food.restaurantId,
  );
  const quantity = cart.find((i) => i.foodId === food._id)?.quantity || 0;
  return (
    <article
      className={`food-card ${!food.available ? "food-unavailable" : ""}`}
    >
      <div className="food-image">
        <img
          src={food.image}
          alt={food.name}
          width={600}
          height={450}
          loading="lazy"
        />
        {food.popular && (
          <span className="popular-badge">
            <Sparkles size={12} />
            Bestseller
          </span>
        )}
        <button
          className={`favourite-button ${favourites.includes(food._id) ? "is-favourite" : ""}`}
          onClick={() => toggleFavourite(food._id)}
          aria-label={`${favourites.includes(food._id) ? "Remove" : "Save"} ${food.name} ${favourites.includes(food._id) ? "from" : "to"} favourites`}
          aria-pressed={favourites.includes(food._id)}
        >
          <Heart
            size={17}
            fill={favourites.includes(food._id) ? "currentColor" : "none"}
          />
        </button>
        <span className="prep-badge">
          <Clock3 size={12} />
          {food.prepMinutes} min prep
        </span>
      </div>
      <div className="food-content">
        <div className="food-source">
          <span
            className={`food-marker ${!food.veg ? "non-veg" : ""}`}
            aria-label={food.veg ? "Vegetarian" : "Non vegetarian"}
          >
            <span />
          </span>
          <span>{restaurant?.name}</span>
        </div>
        <h3>{food.name}</h3>
        <p>{food.description}</p>
        <div className="food-card-bottom">
          <div className="food-price">
            {money(food.price)}
            <span>per serving</span>
          </div>
          {!food.available ? (
            <span className="small muted">Sold out</span>
          ) : quantity ? (
            <Quantity id={food._id} quantity={quantity} />
          ) : (
            <button
              className="add-button"
              onClick={() => addItem(food._id)}
              aria-label={`Add ${food.name} to bag`}
            >
              ADD
              <Plus size={15} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
export function FoodMenu({ full = false }: { full?: boolean }) {
  const { catalog, journey, editJourney, favourites } = useApp();
  const [category, setCategory] = useState<Category>("All");
  const [search, setSearch] = useState("");
  const [vegOnly, setVegOnly] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [sort, setSort] = useState("popular");
  const [restaurant, setRestaurant] = useState("");
  const stop = catalog.routes
    .flatMap((r) => r.stops)
    .find((s) => s.id === journey?.stopId);
  const restaurants = catalog.restaurants.filter(
    (r) => !stop || r.stopIds.includes(stop.id),
  );
  const foods = useMemo(
    () =>
      catalog.foods
        .filter(
          (f) =>
            restaurants.some((r) => r._id === f.restaurantId) &&
            (category === "All" || f.category === category) &&
            (!vegOnly || f.veg) &&
            (!savedOnly || favourites.includes(f._id)) &&
            (!restaurant || f.restaurantId === restaurant) &&
            `${f.name} ${f.description} ${catalog.restaurants.find((r) => r._id === f.restaurantId)?.name}`
              .toLowerCase()
              .includes(search.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "price-low"
            ? a.price - b.price
            : sort === "price-high"
              ? b.price - a.price
              : sort === "fastest"
                ? a.prepMinutes - b.prepMinutes
                : Number(b.popular) - Number(a.popular),
        ),
    [
      catalog,
      restaurants,
      category,
      vegOnly,
      savedOnly,
      favourites,
      restaurant,
      search,
      sort,
    ],
  );
  return (
    <section
      className={`menu-section container ${full ? "full-menu" : ""}`}
      id="menu"
    >
      <div className="section-heading">
        <div>
          <div className="eyebrow">FRESH FROM THE KITCHEN</div>
          <h2>
            {full ? "Your next favourite bite." : "What are you craving?"}
          </h2>
          <p>
            {stop ? (
              <>
                Delivering to{" "}
                <button className="inline-link" onClick={editJourney}>
                  {stop.name}
                </button>
              </>
            ) : (
              "A little comfort. A lot of flavour. Something for every appetite."
            )}
          </p>
        </div>
        {!full && (
          <a href="/menu" className="view-menu-link">
            Explore full menu
            <ArrowRight size={17} />
          </a>
        )}
      </div>
      <div className="menu-controls">
        <div
          className="category-tabs"
          role="group"
          aria-label="Food categories"
        >
          {categories.map(({ name, icon: Icon }) => (
            <button
              key={name}
              onClick={() => setCategory(name)}
              className={`category-tab ${category === name ? "selected" : ""}`}
              aria-pressed={category === name}
            >
              <Icon size={18} />
              {name === "All" ? "All food" : name}
            </button>
          ))}
        </div>
        <label className={`veg-toggle ${vegOnly ? "selected" : ""}`}>
          <input
            type="checkbox"
            checked={vegOnly}
            onChange={(e) => setVegOnly(e.target.checked)}
          />
          <Leaf size={15} />
          Pure veg
          <span className="toggle-track">
            <span />
          </span>
        </label>
      </div>
      {full && (
        <div className="menu-search-row">
          <div className="search-field">
            <Search size={19} />
            <input
              placeholder="Search dishes or restaurants"
              aria-label="Search menu"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="icon-button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <select
            aria-label="Filter restaurant"
            value={restaurant}
            onChange={(e) => setRestaurant(e.target.value)}
          >
            <option value="">All restaurants</option>
            {restaurants.map((r) => (
              <option key={r._id} value={r._id}>
                {r.name}
              </option>
            ))}
          </select>
          <button
            className={`filter-button ${savedOnly ? "selected" : ""}`}
            onClick={() => setSavedOnly(!savedOnly)}
          >
            <Heart size={16} />
            Saved{savedOnly && <Check size={13} />}
          </button>
        </div>
      )}
      <div className="menu-meta">
        <span>
          {foods.length} delicious possibilities{stop && ` at ${stop.city}`}
        </span>
        <label>
          <ArrowDownUp size={14} />
          <span className="sr-only">Sort dishes</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="popular">Recommended</option>
            <option value="price-low">Price: low to high</option>
            <option value="price-high">Price: high to low</option>
            <option value="fastest">Quickest to prepare</option>
          </select>
        </label>
      </div>
      {foods.length ? (
        <div className="food-grid">
          {foods.slice(0, full ? undefined : 4).map((food) => (
            <FoodCard key={food._id} food={food} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <UtensilsCrossed size={38} />
          <h3>No bites found just yet.</h3>
          <p>Try another category, restaurant, or delivery stop.</p>
          <button
            className="button button-outline"
            onClick={() => {
              setCategory("All");
              setSearch("");
              setVegOnly(false);
              setSavedOnly(false);
              setRestaurant("");
            }}
          >
            Reset filters
            <SlidersHorizontal size={17} />
          </button>
        </div>
      )}
      {!full && (
        <div className="menu-bottom">
          <span>Made fresh. Packed with care. Ready for the road.</span>
          <a href="/menu">
            More good food this way
            <ArrowRight size={16} />
          </a>
        </div>
      )}
    </section>
  );
}
