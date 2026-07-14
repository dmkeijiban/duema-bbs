-- 《幻緑の双月／母なる星域》の両面カード画像を正しいa面URLへ修正する。
update public.cards
set image_url = 'https://dm.takaratomy.co.jp/wp-content/card/cardimage/dmex04-052a.jpg'
where source_kind = 'takaratomy_card_id'
  and source_key = 'dmex04-052'
  and image_url is distinct from 'https://dm.takaratomy.co.jp/wp-content/card/cardimage/dmex04-052a.jpg';

do $$ begin
  if not exists (
    select 1 from public.cards
    where source_kind = 'takaratomy_card_id'
      and source_key = 'dmex04-052'
      and image_url = 'https://dm.takaratomy.co.jp/wp-content/card/cardimage/dmex04-052a.jpg'
  ) then
    raise exception 'HALL_RELEASE_GENNRYOKU_IMAGE_NOT_UPDATED';
  end if;
end $$;
