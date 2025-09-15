import { useGenreStore } from '@/stores/genreStore';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

export const GenreTabs = () => {
  const { genres, activeGenreId, setActiveGenre } = useGenreStore();

  return (
    <div className="border-b">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex space-x-1 p-1">
          {genres.map((genre) => (
            <Button
              key={genre.id}
              variant={activeGenreId === genre.id ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveGenre(genre.id)}
              className="flex-shrink-0"
            >
              {genre.name}
            </Button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};