-- Table for zoning data from DataSF
drop table if exists zoning_sf;
create table zoning_sf (
    id serial primary key,
    parcel_id varchar(64),
    zoning_district varchar(64),
    zoning_category varchar(128),
    base_zoning varchar(128),
    overlay varchar(128),
    special_use_district varchar(128),
    height_limit varchar(64),
    geometry geometry(Polygon, 4326),
    raw_json jsonb,
    updated_at timestamp default now()
);

create index if not exists zoning_sf_geom_gix on zoning_sf using gist(geometry);
create index if not exists zoning_sf_parcel_id_idx on zoning_sf(parcel_id);
